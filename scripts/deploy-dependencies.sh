#!/usr/bin/env bash
# Deploys the package dependencies declared in sfdx-project.json as source, so a
# lib can be tested against the libs it depends on without installing packages.
#
# Usage (from the root of the lib):
#   deploy-dependencies.sh <target-org>
#
# For every entry in packageDirectories[].dependencies:
#   "SOQL Lib@6.12.0-1"                 -> <owner>/soql-lib at tag v6.12.0
#   "DML Lib" + versionNumber 4.0.0.LATEST -> <owner>/dml-lib at tag v4.0.0
# The repo name is the package name lowercased with spaces as dashes. The dir
# deployed is the packageDirectory of that repo with the same package name.
# Test classes of the dependency are left out: they are that lib's concern and
# can clash with the caller's org setup (features, validation rules).
#
# Env:
#   DEPENDENCIES_OWNER  GitHub owner of the dependency repos (default beyond-the-cloud-dev)
#   GH_TOKEN            when set, clones with gh (needed for private repos in CI)
#   DEPLOY_WAIT         deploy timeout in minutes (default 30)

set -euo pipefail

TARGET_ORG="${1:?usage: deploy-dependencies.sh <target-org>}"
OWNER="${DEPENDENCIES_OWNER:-beyond-the-cloud-dev}"
WAIT="${DEPLOY_WAIT:-30}"
WORK_DIR="${RUNNER_TEMP:-$(mktemp -d)}/dependencies"

DEPENDENCIES=$(jq -r '.packageDirectories[] | .dependencies // [] | .[] | [.package, (.versionNumber // "")] | @tsv' sfdx-project.json)

if [ -z "$DEPENDENCIES" ]; then
  echo "No dependencies in sfdx-project.json"
  exit 0
fi

while IFS=$'\t' read -r package version <&3; do
  name="${package%@*}"
  if [ "$package" != "$name" ]; then
    version="${package#*@}"
  fi
  semver=$(echo "$version" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+' || true)
  if [ -z "$semver" ]; then
    echo "::error::Cannot read a version from dependency '$package'. Use an alias like 'Name@1.2.0-1' or set versionNumber."
    exit 1
  fi

  repo="$OWNER/$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
  tag="v$semver"
  target="$WORK_DIR/${repo##*/}"

  echo "::group::📚 $name $semver ($repo@$tag)"
  rm -rf "$target"
  if [ -n "${GH_TOKEN:-}" ] && command -v gh > /dev/null; then
    clone=(gh repo clone "$repo" "$target" --)
  else
    clone=(git clone "https://github.com/$repo.git" "$target")
  fi
  if ! "${clone[@]}" --quiet --depth 1 --branch "$tag" --config advice.detachedHead=false; then
    echo "::error::Cannot clone $repo at $tag. Every released package version needs a matching v<major>.<minor>.<patch> tag in its repo."
    exit 1
  fi

  dir=$(jq -r --arg name "$name" '.packageDirectories[] | select(.package == $name) | .path' "$target/sfdx-project.json")
  if [ -z "$dir" ]; then
    echo "::error::$repo@$tag has no packageDirectory for package '$name'"
    exit 1
  fi

  { grep -rl --null -i -E --include='*.cls' '^[[:space:]]*@istest' "$target/$dir" || true; } | while IFS= read -r -d '' test_class; do
    rm -f "$test_class" "$test_class-meta.xml"
  done

  (cd "$target" && sf project deploy start --source-dir "$dir" --target-org "$TARGET_ORG" --wait "$WAIT")
  echo "::endgroup::"
done 3<<< "$DEPENDENCIES"
