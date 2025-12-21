# CI/CD Templates for GitHub Actions

Central repository with reusable workflows for Salesforce and other projects.

## 📋 Table of Contents

- [Available Workflows](#available-workflows)
- [How to Use](#how-to-use)
- [Secrets Configuration](#secrets-configuration)
- [Usage Examples](#usage-examples)
- [Requirements](#requirements)
- [Security Best Practices](#security-best-practices)

## 🔄 Available Workflows

### Salesforce CI (Full Pipeline)
[.github/workflows/salesforce-ci.yml](.github/workflows/salesforce-ci.yml)

Complete CI pipeline for Salesforce projects:
- ✅ Scratch org creation
- ✅ Code deployment
- ✅ Apex test execution
- ✅ Code coverage
- ✅ Optional Codecov upload
- ✅ Automatic cleanup

### Salesforce PMD Code Scanner
[.github/workflows/salesforce-pmd-scanner.yml](.github/workflows/salesforce-pmd-scanner.yml)

Apex code quality scanning using PMD:
- ✅ Static code analysis
- ✅ Potential bug detection
- ✅ Security best practices verification
- ✅ Performance and code style checking
- ✅ Report generation

## 🚀 How to Use

### Step 1: Add Workflow to Your Project

Create a `.github/workflows/ci.yml` file in your repository:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  salesforce-ci:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
    with:
      node-version: '20'
      test-level: 'RunLocalTests'
      upload-to-codecov: true
      codecov-slug: ${{ github.repository }}
    secrets:
      SFDX_AUTH_URL_DEVHUB: ${{ secrets.SFDX_AUTH_URL_DEVHUB }}
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### Step 2: Configure Secrets

Add required secrets in your repository (Settings → Secrets and variables → Actions):

**Required:**
- `SFDX_AUTH_URL_DEVHUB` - Dev Hub authentication URL

**Optional:**
- `CODECOV_TOKEN` - Token for coverage upload (if using Codecov)

## 🔐 Secrets Configuration

### For Public Repositories
You can use Organization Secrets, which will be automatically available in all public repositories.

### For Private Repositories (Free Plan)
Unfortunately, GitHub's free plan doesn't provide Organization Secrets for private repositories. You must manually add secrets in each repository:

1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add secrets with **exactly the same names** as in the template

**Important:** Secret names must match! Repository secrets take precedence over Organization secrets.

### How to Get SFDX_AUTH_URL_DEVHUB

```bash
# Log in to your Dev Hub
sf org login web --alias DevHub --set-default-dev-hub

# Display auth URL
sf org display --verbose --target-org DevHub
```

Copy the `Sfdx Auth Url` value and add it as a secret.

## 📚 Usage Examples

All examples are located in the [examples](./examples/) directory:

### 1. Full CI with Tests and Codecov
[examples/salesforce-ci.yml](./examples/salesforce-ci.yml)
```yaml
jobs:
  salesforce-ci:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
    with:
      node-version: '20'
      sf-cli-version: 'latest'  # or specific version like '2.0.0'
      upload-to-codecov: true
      codecov-slug: ${{ github.repository }}
    secrets:
      SFDX_AUTH_URL_DEVHUB: ${{ secrets.SFDX_AUTH_URL_DEVHUB }}
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### 2. CI with PMD Code Quality Scanning
[examples/salesforce-ci-with-sast.yml](./examples/salesforce-ci-with-sast.yml)
```yaml
jobs:
  code-quality:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-pmd-scanner.yml@main

  salesforce-ci:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
```

## ⚙️ Configuration Parameters

### Salesforce CI - Inputs

| Parameter | Type | Default Value | Description |
|----------|-----|------------------|------|
| `node-version` | string | `'20'` | Node.js version |
| `sf-cli-version` | string | `'latest'` | Salesforce CLI version (e.g., "2.0.0" or "latest") |
| `scratch-org-duration` | number | `1` | Scratch org lifetime (days) |
| `scratch-org-wait` | number | `30` | Scratch org creation timeout (min) |
| `deploy-wait` | number | `30` | Deployment timeout (min) |
| `test-wait` | number | `30` | Test timeout (min) |
| `test-level` | string | `'RunLocalTests'` | Test level (RunLocalTests, RunAllTestsInOrg) |
| `scratch-def-file` | string | `'config/project-scratch-def.json'` | Path to scratch org definition |
| `upload-to-codecov` | boolean | `false` | Upload coverage to Codecov |
| `codecov-slug` | string | `''` | Repository slug for Codecov (org/repo) |

### Salesforce CI - Secrets

| Secret | Required | Description |
|--------|----------|------|
| `SFDX_AUTH_URL_DEVHUB` | ✅ Yes | Dev Hub authentication URL |
| `CODECOV_TOKEN` | ❌ No | Codecov token (only if upload-to-codecov=true) |

### PMD Scanner - Inputs

| Parameter | Type | Default Value | Description |
|----------|-----|------------------|------|
| `node-version` | string | `'20'` | Node.js version |
| `pmd-version` | string | `'7.0.0'` | PMD version |
| `ruleset` | string | `'ruleset.xml'` | Path to PMD ruleset file |
| `source-path` | string | `'force-app'` | Path to source code |
| `fail-on-violation` | boolean | `false` | Fail on violations |

## 🖥️ Supported Systems

- ✅ **Linux** (ubuntu-latest)
- ✅ **macOS** (can change runner to `macos-latest`)
- ✅ **Windows** (can change runner to `windows-latest`)

To use a different runner, you can override the workflow or create your own version.

## 📝 Requirements

- **Node.js 20+** (default, configurable)
- **Salesforce CLI** (installed automatically)
- **Dev Hub** with scratch org creation permissions
- **Git** (for code checkout)

**Note:** You don't need `package.json` or `package-lock.json` in your Salesforce projects. The workflow installs Salesforce CLI globally without requiring npm dependencies in your project.

## 🔄 Updates

Workflows use the `@main` tag, so they will always fetch the latest version. If you want to use a specific version:

```yaml
uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@v1.0.0
```

## 🔒 Security Best Practices

### Understanding the Security Model

When you make this repository **public**, the workflow code becomes visible to everyone, but this does **NOT** expose your secrets. Here's why:

#### ✅ What is Safe (No Security Risk)

1. **Secrets are NEVER exposed** in public repositories
   - GitHub Secrets are encrypted and never visible in logs or code
   - Even if someone forks your repository, they cannot access your secrets
   - Workflow logs automatically redact secret values (shown as `***`)

2. **Workflow code visibility is normal**
   - Public reusable workflows are a standard GitHub feature
   - Your workflow code doesn't contain sensitive data (only references to secrets)
   - Anyone can see WHAT your workflow does, but not the SECRET VALUES

3. **Organization-level protection**
   - If this repository is in a GitHub Organization, you can configure access policies
   - Settings → Actions → General → "Access" section
   - Choose which repositories can use your reusable workflows

#### ⚠️ Potential Risks and How to Mitigate

1. **Malicious Pull Requests from Forks (PUBLIC REPOS ONLY)**
   - **Risk**: In public repositories, anyone can fork and create a PR that might try to exfiltrate secrets
   - **Mitigation**:
     ```yaml
     # In your calling repository's workflow:
     on:
       pull_request_target:  # DON'T use this with untrusted code!
         # This gives PR access to secrets - dangerous!

     # Instead, use:
     on:
       pull_request:  # ✅ SAFE - secrets not available to forks
         # Forks won't have access to secrets
     ```
   - **Best Practice**: Require approval for workflows from first-time contributors
     - Go to: Repository Settings → Actions → General
     - Select "Require approval for first-time contributors"

2. **Accidental Secret Logging**
   - **Risk**: Someone might accidentally echo secrets in logs
   - **Mitigation**:
     - GitHub automatically redacts registered secrets
     - Never use `set -x` or `echo` with secret variables
     - Review workflow changes carefully

3. **Scope of Access**
   - **Risk**: Secrets have access to your entire Dev Hub
   - **Mitigation**:
     - Use dedicated CI/CD user with minimal permissions
     - Create a separate Dev Hub user just for CI/CD
     - Regularly rotate your `SFDX_AUTH_URL_DEVHUB`

#### 🛡️ Recommended Security Configuration

1. **Enable Branch Protection**
   ```
   Repository Settings → Branches → Add branch protection rule
   ✅ Require pull request reviews before merging
   ✅ Require status checks to pass before merging
   ✅ Require linear history
   ✅ Do not allow bypassing the above settings
   ```

2. **Configure Workflow Permissions**
   ```
   Repository Settings → Actions → General → Workflow permissions
   ✅ Read repository contents permission (default)
   ❌ Do NOT enable "Read and write permissions" unless needed
   ```

3. **Use Environment Secrets for Extra Protection**
   - Create environments (e.g., "production", "staging")
   - Add required reviewers for sensitive environments
   - Store sensitive secrets at environment level, not repository level

4. **Monitor Secret Usage**
   - Regularly review Actions logs in your repositories
   - Set up notifications for workflow failures
   - Check for unusual workflow runs

5. **For Organization Repositories**
   ```
   Organization Settings → Actions → General

   "Fork pull request workflows from outside collaborators":
   ✅ Require approval for first-time contributors who recently created account
   ✅ Require approval for all outside collaborators
   ```

#### 📋 Security Checklist Before Making Repository Public

- [ ] Remove any hardcoded credentials or tokens from code
- [ ] Verify all sensitive data is in GitHub Secrets (not in code)
- [ ] Enable branch protection on main branch
- [ ] Set "Require approval for first-time contributors" in Actions settings
- [ ] Review all workflow files for accidental secret exposure
- [ ] Use dedicated CI/CD service account with minimal permissions
- [ ] Document which secrets are required in README
- [ ] Set up proper access policies if using GitHub Organization
- [ ] Consider using environment-level secrets for sensitive operations

#### ❓ Common Questions

**Q: If someone forks my public repo, can they see my secrets?**
A: No, secrets are never copied to forks. Each repository maintains its own secrets.

**Q: Can malicious code in a PR access my secrets?**
A: Not if you use `pull_request` trigger (recommended). Only use `pull_request_target` with extreme caution.

**Q: What happens if I accidentally commit a secret to git?**
A: Immediately:
1. Revoke/rotate the secret in Salesforce
2. Remove it from git history (use tools like `git filter-branch` or BFG Repo-Cleaner)
3. Update the secret in GitHub Secrets

**Q: Should I use a personal access token or SFDX Auth URL?**
A: Use SFDX Auth URL for Salesforce. It's more secure and can be easily revoked.

## 💡 Best Practices

1. **Use `@main` for development**, `@v1.0.0` for production
2. **Add secrets at organization level** for public repositories
3. **Keep secret names consistent** across all repositories
4. **Use dedicated CI/CD service accounts** with minimal required permissions
5. **Enable branch protection** and require PR reviews
6. **Regularly audit** workflow runs and secret usage
7. **Rotate secrets periodically** as part of security hygiene

## 🤝 Contributing

Have an idea for a new workflow? Create a Pull Request!

1. Fork this repository
2. Create a branch for your workflow
3. Add workflow in `.github/workflows/`
4. Add example in `examples/`
5. Update README.md
6. Create a Pull Request

## 📄 License

MIT License - you can use this repository in your projects.