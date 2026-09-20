// Posts (or updates) the Salesforce CI summary comment on the pull request.
//
// Called from actions/github-script:
//   const comment = require('./.cicd-template/scripts/pr-comment.js');
//   await comment({ github, context, core });
//
// Input comes from environment variables set on the step:
//   DEPLOY_STATUS        success | failed | error | skipped | cancelled  (from deploy-report.js)
//   DEPLOY_SUMMARY_FILE  markdown written by deploy-report.js
//   TEST_SUMMARY_FILE    plain text written by the "Parse test results" step
//   TEST_HAS_FAILURES    "true" | "false"
//   TEST_TOTAL, TEST_PASSED, TEST_FAILED
//   WORKFLOW_FILE        name of the reusable workflow file, for the footer link

"use strict";

const fs = require("fs");

const MARKER = "<!-- salesforce-ci-report -->";
const LEGACY_MARKER = "🧪 Apex Test Results";
const MAX_COMMENT_LENGTH = 65000;
const TEMPLATE_REPO = "https://github.com/beyond-the-cloud-dev/cicd-template";

module.exports = async function postComment({ github, context, core }) {
  const env = process.env;
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

  const body = buildBody({
    deployStatus: env.DEPLOY_STATUS || "skipped",
    deploySummary: readIfExists(env.DEPLOY_SUMMARY_FILE || "./tests/apex/deploy-summary.md"),
    testSummary: readIfExists(env.TEST_SUMMARY_FILE || "./tests/apex/test-summary.txt"),
    testHasFailures: env.TEST_HAS_FAILURES === "true",
    testTotal: env.TEST_TOTAL || "0",
    testPassed: env.TEST_PASSED || "0",
    testFailed: env.TEST_FAILED || "0",
    workflowFile: env.WORKFLOW_FILE || "salesforce-ci.yml",
    runUrl,
  });

  const { owner, repo } = context.repo;
  const issue_number = context.issue.number;

  const { data: comments } = await github.rest.issues.listComments({ owner, repo, issue_number, per_page: 100 });
  const existing = comments.find(
    (c) => c.user && c.user.type === "Bot" && (c.body.includes(MARKER) || c.body.includes(LEGACY_MARKER))
  );

  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    core.info(`Updated PR comment ${existing.id}`);
  } else {
    const { data: created } = await github.rest.issues.createComment({ owner, repo, issue_number, body });
    core.info(`Created PR comment ${created.id}`);
  }
};

function buildBody(input) {
  const lines = [MARKER, "## 🚀 Salesforce CI", ""];

  if (input.deployStatus !== "success") {
    lines.push(input.deploySummary || "### ❌ Deployment failed\n\nNo deployment report available. Check the workflow logs.");
  } else {
    lines.push("### ✅ Deployment succeeded", "");
    if (input.testTotal === "0") {
      lines.push("### ⚠️ No test results", "");
    } else if (input.testHasFailures) {
      lines.push("### ❌ Tests failed", "");
    } else {
      lines.push("### ✅ All tests passed", "");
    }
    lines.push("```", (input.testSummary || "No test summary available.").trim(), "```");
  }

  lines.push("", `📦 **[Workflow run, logs and artifacts](${input.runUrl})**`);

  let body = lines.join("\n");

  const footer = [];
  footer.push("", "", "---");
  if (input.deployStatus === "success") {
    footer.push(`📊 Stats: ${input.testTotal} total | ✅ ${input.testPassed} passed | ❌ ${input.testFailed} failed`);
  }
  footer.push(`🤖 _Automated comment by [Salesforce CI](${TEMPLATE_REPO}/blob/main/.github/workflows/${input.workflowFile})_`);
  const footerText = footer.join("\n");

  const limit = MAX_COMMENT_LENGTH - footerText.length;
  if (body.length > limit) {
    body = body.slice(0, limit - 200) + `\n\n... (truncated)\n\n⚠️ **Comment truncated due to size.** [See the full report](${input.runUrl})\n`;
  }

  return body + footerText;
}

function readIfExists(file) {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  } catch {
    return "";
  }
}

module.exports.buildBody = buildBody;
