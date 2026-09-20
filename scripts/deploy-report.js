#!/usr/bin/env node
// Parses the JSON output of `sf project deploy start --json` and turns it into:
//   - a Markdown report (for the PR comment and the job summary)
//   - GitHub Actions annotations (::error file=...,line=...) on the failing files
//   - step outputs: status, error_count, warning_count, summary_file
//
// Usage:
//   node deploy-report.js <deploy-result.json> <deploy-summary.md>
//
// Works with no dependencies on Node 18+. Safe to run when the JSON file is
// missing or not valid JSON: it then reports the deploy as "error" instead of
// crashing, so the workflow can still comment on the PR.

"use strict";

const fs = require("fs");
const path = require("path");
const { findTip } = require("./deploy-tips");

const MAX_TABLE_ROWS = 40;
const MAX_LINES_PER_ROW = 5;
const MAX_ANNOTATIONS = 10;
const MAX_TEST_FAILURES = 20;

function main() {
  const [, , inputArg, outputArg] = process.argv;
  const inputFile = inputArg || process.env.DEPLOY_RESULT_FILE || "./tests/apex/deploy-result.json";
  const outputFile = outputArg || process.env.DEPLOY_SUMMARY_FILE || "./tests/apex/deploy-summary.md";

  const report = buildReport(readDeployJson(inputFile));

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, report.markdown, "utf8");

  appendToFile(process.env.GITHUB_STEP_SUMMARY, report.markdown + "\n");
  appendToFile(
    process.env.GITHUB_OUTPUT,
    [
      `status=${report.status}`,
      `error_count=${report.errorCount}`,
      `warning_count=${report.warningCount}`,
      `summary_file=${outputFile}`,
      "",
    ].join("\n")
  );

  for (const annotation of report.annotations) {
    console.log(annotation);
  }
  console.log(report.consoleText);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function readDeployJson(file) {
  if (!fs.existsSync(file)) {
    return { parseError: `Deploy result file not found: ${file}` };
  }
  const raw = fs.readFileSync(file, "utf8");
  // The CLI can print warnings before the JSON payload; start at the first "{".
  const start = raw.indexOf("{");
  if (start < 0) {
    return { parseError: `No JSON found in ${file}`, raw };
  }
  try {
    return JSON.parse(raw.slice(start));
  } catch (err) {
    return { parseError: `Could not parse ${file}: ${err.message}`, raw };
  }
}

// ---------------------------------------------------------------------------
// Report model
// ---------------------------------------------------------------------------

function buildReport(json) {
  const result = json.result || {};
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const stepOutcome = process.env.DEPLOY_STEP_OUTCOME || "";

  // The deploy step never ran (scratch org creation or Dev Hub auth failed earlier).
  if (stepOutcome === "skipped" || stepOutcome === "cancelled") {
    const title = stepOutcome === "cancelled" ? "Deployment cancelled" : "Deployment skipped";
    return {
      status: stepOutcome,
      errorCount: 0,
      warningCount: 0,
      markdown: [
        `### ⏭️ ${title}`,
        "",
        "An earlier step failed (scratch org creation or Dev Hub authorization), so nothing was deployed. Check the workflow logs.",
      ].join("\n"),
      annotations: [],
      consoleText: `⏭️ ${title}: an earlier step failed, nothing was deployed.`,
    };
  }

  if (json.parseError) {
    return unknownFailure("Deploy result could not be read", json.parseError, json.raw);
  }

  // The CLI threw before/without a deploy result (auth, network, bad flags...).
  if (!json.result) {
    const message = json.message || json.name || "Unknown error";
    const tip = findTip(message);
    return unknownFailure(json.name || "Deploy command failed", message, null, tip);
  }

  const failures = collectFailures(result, workspace);
  const errors = failures.filter((f) => f.problemType !== "Warning");
  const warnings = failures.filter((f) => f.problemType === "Warning");
  const testFailures = toArray(result.details && result.details.runTestResult && result.details.runTestResult.failures);
  const coverageWarnings = toArray(
    result.details && result.details.runTestResult && result.details.runTestResult.codeCoverageWarnings
  );

  const succeeded = result.success === true && json.status === 0;
  const status = succeeded ? "success" : "failed";

  const groups = groupFailures(errors);
  const tips = collectTips(groups);

  const markdown = renderMarkdown({
    status,
    result,
    errors,
    warnings,
    groups,
    tips,
    testFailures,
    coverageWarnings,
  });

  return {
    status,
    errorCount: errors.length,
    warningCount: warnings.length,
    markdown,
    annotations: renderAnnotations(groups),
    consoleText: renderConsole({ status, result, errors, groups, tips, testFailures }),
  };
}

function unknownFailure(title, message, raw, tip) {
  const lines = [
    "### ❌ Deployment failed",
    "",
    `**${escapeMd(title)}**`,
    "",
    "```",
    truncate(String(message || "").trim(), 3000),
    "```",
  ];
  if (tip) {
    lines.push("", "💡 **Hints**", "", `- **${tip.label}**: ${tip.hint}`);
  }
  if (raw) {
    lines.push("", "<details><summary>Raw output</summary>", "", "```", truncate(raw.trim(), 4000), "```", "", "</details>");
  }
  return {
    status: "error",
    errorCount: 1,
    warningCount: 0,
    markdown: lines.join("\n"),
    annotations: [`::error title=${title}::${oneLine(truncate(String(message), 500))}`],
    consoleText: `❌ ${title}\n${message}`,
  };
}

// Normalises the two places a failure can show up in the CLI JSON:
//   result.files[]                      (has filePath, error text includes "(line:col)")
//   result.details.componentFailures[]  (has clean problem text, no filePath)
function collectFailures(result, workspace) {
  const fromFiles = toArray(result.files)
    .filter((f) => f.state === "Failed")
    .map((f) => ({
      type: f.type,
      fullName: f.fullName,
      problem: stripLocation(f.error),
      problemType: f.problemType || "Error",
      filePath: relativePath(f.filePath, workspace),
      line: f.lineNumber,
      column: f.columnNumber,
    }));

  if (fromFiles.length > 0) {
    return fromFiles;
  }

  return toArray(result.details && result.details.componentFailures)
    .filter((f) => f.success === false || f.problemType === "Error" || f.problemType === "Warning")
    .map((f) => ({
      type: f.componentType,
      fullName: f.fullName,
      problem: stripLocation(f.problem),
      problemType: f.problemType || "Error",
      filePath: f.fileName,
      line: f.lineNumber,
      column: f.columnNumber,
    }));
}

// Same component + same problem text => one row with a list of lines.
function groupFailures(failures) {
  const map = new Map();
  for (const f of failures) {
    const key = `${f.type}|${f.fullName}|${f.problem}`;
    if (!map.has(key)) {
      map.set(key, { ...f, locations: [] });
    }
    if (f.line) {
      map.get(key).locations.push({ line: f.line, column: f.column });
    }
  }
  return [...map.values()].map((g) => ({
    ...g,
    locations: g.locations.sort((a, b) => a.line - b.line),
    tip: findTip(g.problem),
  }));
}

function collectTips(groups) {
  const byId = new Map();
  for (const g of groups) {
    if (!g.tip) continue;
    if (!byId.has(g.tip.id)) {
      byId.set(g.tip.id, { tip: g.tip, components: new Set() });
    }
    byId.get(g.tip.id).components.add(g.fullName);
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderMarkdown({ status, result, errors, warnings, groups, tips, testFailures, coverageWarnings }) {
  const lines = [];
  const stats = deployStats(result);

  if (status === "success") {
    lines.push("### ✅ Deployment succeeded", "", stats);
    if (warnings.length > 0) {
      lines.push("", `⚠️ ${warnings.length} warning(s):`, "");
      for (const w of warnings.slice(0, MAX_TABLE_ROWS)) {
        lines.push(`- \`${w.type}\` **${escapeMd(w.fullName)}**: ${escapeMd(w.problem)}`);
      }
    }
    return lines.join("\n");
  }

  lines.push("### ❌ Deployment failed", "", stats, "");

  if (groups.length > 0) {
    const componentCount = new Set(groups.map((g) => `${g.type}:${g.fullName}`)).size;
    lines.push(
      `**${errors.length} error(s)** in ${componentCount} component(s)`,
      "",
      "| Component | Problem | Line |",
      "| --- | --- | --- |"
    );
    for (const g of groups.slice(0, MAX_TABLE_ROWS)) {
      lines.push(`| \`${g.type}\` **${escapeMd(g.fullName)}** | ${escapeMd(g.problem)} | ${formatLocations(g.locations)} |`);
    }
    if (groups.length > MAX_TABLE_ROWS) {
      lines.push("", `_... and ${groups.length - MAX_TABLE_ROWS} more. See the workflow logs or the \`apex-test-results\` artifact._`);
    }
  } else if (testFailures.length === 0 && coverageWarnings.length === 0) {
    lines.push("No component failures were reported. Check the workflow logs for details.");
  }

  if (testFailures.length > 0) {
    lines.push("", `**${testFailures.length} test failure(s) during deploy**`, "");
    for (const t of testFailures.slice(0, MAX_TEST_FAILURES)) {
      lines.push(`- **${escapeMd(t.name)}.${escapeMd(t.methodName)}**`, `  └─ ${escapeMd(oneLine(t.message || "No message"))}`);
    }
    if (testFailures.length > MAX_TEST_FAILURES) {
      lines.push(`- _... and ${testFailures.length - MAX_TEST_FAILURES} more_`);
    }
  }

  if (coverageWarnings.length > 0) {
    lines.push("", "**Code coverage warnings**", "");
    for (const c of coverageWarnings) {
      lines.push(`- ${c.name ? `**${escapeMd(c.name)}**: ` : ""}${escapeMd(c.message)}`);
    }
  }

  if (warnings.length > 0) {
    lines.push("", `⚠️ ${warnings.length} warning(s) (not blocking):`, "");
    for (const w of warnings.slice(0, 10)) {
      lines.push(`- \`${w.type}\` **${escapeMd(w.fullName)}**: ${escapeMd(w.problem)}`);
    }
  }

  if (tips.length > 0) {
    lines.push("", "💡 **Hints**", "");
    for (const { tip, components } of tips) {
      const names = [...components].slice(0, 5).map((n) => `\`${n}\``).join(", ");
      const more = components.size > 5 ? ` +${components.size - 5} more` : "";
      lines.push(`- **${tip.label}** (${names}${more}): ${tip.hint}`);
    }
  }

  return lines.join("\n");
}

function deployStats(result) {
  const parts = [];
  if (result.id) parts.push(`Deploy ID \`${result.id}\``);
  if (Number.isFinite(result.numberComponentsTotal)) {
    parts.push(`${result.numberComponentsDeployed || 0}/${result.numberComponentsTotal} components deployed`);
  }
  if (Number.isFinite(result.numberTestsTotal) && result.numberTestsTotal > 0) {
    parts.push(`${result.numberTestsCompleted || 0}/${result.numberTestsTotal} tests`);
  }
  return parts.join(" · ");
}

function formatLocations(locations) {
  if (locations.length === 0) return "";
  const shown = locations.slice(0, MAX_LINES_PER_ROW).map((l) => String(l.line));
  const more = locations.length > MAX_LINES_PER_ROW ? ` +${locations.length - MAX_LINES_PER_ROW} more` : "";
  return shown.join(", ") + more;
}

function renderAnnotations(groups) {
  const out = [];
  for (const g of groups) {
    if (out.length >= MAX_ANNOTATIONS) break;
    const loc = g.locations[0];
    const props = [];
    if (g.filePath) props.push(`file=${g.filePath}`);
    if (loc && loc.line) props.push(`line=${loc.line}`);
    if (loc && loc.column) props.push(`col=${loc.column}`);
    props.push(`title=${g.type} ${g.fullName}`);
    const extra = g.locations.length > 1 ? ` (${g.locations.length} occurrences)` : "";
    out.push(`::error ${props.join(",")}::${oneLine(g.problem)}${extra}`);
  }
  return out;
}

function renderConsole({ status, result, errors, groups, tips, testFailures }) {
  const lines = ["", "=========================================="];
  if (status === "success") {
    lines.push("     DEPLOYMENT SUCCEEDED", "==========================================", deployStats(result));
    return lines.join("\n");
  }
  lines.push("     DEPLOYMENT FAILED", "==========================================", deployStats(result), "");
  lines.push(`${errors.length} error(s):`, "");
  for (const g of groups.slice(0, MAX_TABLE_ROWS)) {
    lines.push(`❌ ${g.type} ${g.fullName}`);
    lines.push(`   ${g.problem}`);
    if (g.locations.length > 0) lines.push(`   lines: ${formatLocations(g.locations)}`);
    if (g.filePath) lines.push(`   file: ${g.filePath}`);
    lines.push("");
  }
  for (const t of testFailures.slice(0, MAX_TEST_FAILURES)) {
    lines.push(`❌ TEST ${t.name}.${t.methodName}`, `   ${oneLine(t.message || "")}`, "");
  }
  if (tips.length > 0) {
    lines.push("Hints:");
    for (const { tip } of tips) {
      lines.push(`💡 ${tip.label}: ${tip.hint}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

// "Variable is not visible: X (662:9)" -> "Variable is not visible: X"
function stripLocation(text) {
  return String(text || "")
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .trim();
}

function relativePath(file, workspace) {
  if (!file) return "";
  const normalized = String(file).replace(/\\/g, "/");
  const root = String(workspace).replace(/\\/g, "/").replace(/\/$/, "") + "/";
  return normalized.startsWith(root) ? normalized.slice(root.length) : normalized;
}

function escapeMd(text) {
  return oneLine(String(text || "")).replace(/\|/g, "\\|");
}

function oneLine(text) {
  return String(text || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + "\n... (truncated)" : text;
}

function appendToFile(file, content) {
  if (!file) return;
  fs.appendFileSync(file, content, "utf8");
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // Never fail the workflow because of the reporter itself.
    console.error(`::warning title=deploy-report::${oneLine(err.stack || err.message)}`);
    appendToFile(process.env.GITHUB_OUTPUT, "status=error\nerror_count=1\nwarning_count=0\n");
  }
}

module.exports = { buildReport, collectFailures, groupFailures, stripLocation, relativePath };
