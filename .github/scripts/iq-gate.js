// Custom Sonatype Lifecycle gate.
//
// The shared demo IQ Server reports violations but its policies have no
// enforcing action ("Policy Action: None"), so the CLI always exits 0. This
// script reads the CLI result file and fails the build on thresholds we own,
// independent of the server-side policy configuration.
//
// Thresholds come from env vars; a negative value means "no limit".
//   MAX_CRITICAL (default 0), MAX_SEVERE (default -1), MAX_MODERATE (default -1)

const fs = require("fs");

const REPORT = "./iq-reports/policy-eval.json";
const limit = {
  critical: parseInt(process.env.MAX_CRITICAL ?? "0", 10),
  severe: parseInt(process.env.MAX_SEVERE ?? "-1", 10),
  moderate: parseInt(process.env.MAX_MODERATE ?? "-1", 10),
};

if (!fs.existsSync(REPORT)) {
  console.log(`::error::Result file ${REPORT} not found — did the scan run?`);
  process.exit(1);
}

const result = JSON.parse(fs.readFileSync(REPORT, "utf8"));
const p = result.policyEvaluationResult || {};
const counts = {
  critical: p.criticalPolicyViolationCount || 0,
  severe: p.severePolicyViolationCount || 0,
  moderate: p.moderatePolicyViolationCount || 0,
};

console.log(
  `Sonatype policy violations — critical: ${counts.critical}, ` +
    `severe: ${counts.severe}, moderate: ${counts.moderate}`
);
console.log(`Report: ${result.reportHtmlUrl}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const show = (n) => (n < 0 ? "—" : n);
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Sonatype Lifecycle gate\n\n` +
      `| Severity | Violations | Threshold |\n| --- | --- | --- |\n` +
      `| Critical | ${counts.critical} | ${show(limit.critical)} |\n` +
      `| Severe | ${counts.severe} | ${show(limit.severe)} |\n` +
      `| Moderate | ${counts.moderate} | ${show(limit.moderate)} |\n\n` +
      `[View full report](${result.reportHtmlUrl})\n`
  );
}

let failed = false;
for (const sev of ["critical", "severe", "moderate"]) {
  if (limit[sev] >= 0 && counts[sev] > limit[sev]) {
    console.log(
      `::error::${sev} violations (${counts[sev]}) exceed threshold (${limit[sev]})`
    );
    failed = true;
  }
}

if (failed) {
  console.log("Failing build on Sonatype Lifecycle policy thresholds.");
  process.exit(1);
}
console.log("Within thresholds — passing.");
