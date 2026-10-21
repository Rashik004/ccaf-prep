// compare.ts — Step 5: put single-pass and multi-pass side by side.
// Every function returns text; index.ts prints it. Model-quality outcomes are
// observed and logged, never thrown: a run that shows no difference is a valid result.

import { SEEDED, caught, caughtByIntegration } from "./answer-key";
import { logObservation } from "./log";
import type { CrossFileIssue, FileReview, LocalReview, SeededIssue, SourceFile } from "./types";

export interface ComparisonInput {
  files: SourceFile[];
  single: FileReview[];
  local: LocalReview[];
  integration: CrossFileIssue[];
  keyApplies: boolean;
}

/** Pad every cell but the last so the columns line up in a plain-text terminal. */
function row(cells: string[], widths: number[]): string {
  return cells.map((c, i) => (i < widths.length ? c.padEnd(widths[i]) : c)).join("  ").trimEnd();
}

function average(reviews: FileReview[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((n, r) => n + r.issues.length, 0) / reviews.length;
}

/** Findings per file, max minus min: the lesson's "consistent issue counts across files". */
function spread(reviews: FileReview[]): number {
  if (reviews.length === 0) return 0;
  const counts = reviews.map((r) => r.issues.length);
  return Math.max(...counts) - Math.min(...counts);
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

/**
 * Review depth of the first three files against the last three.
 * Depth = findings per file, a proxy; dilution shows as fewer findings for later files.
 * sample-repo plants local bugs at both ends (files 01-02 and 08-10), so a drop reflects
 * attention, not where the bugs are. Any drop counts: there is no tolerance.
 */
export function depthLine(label: "single-pass" | "multi-pass", reviews: FileReview[]): string {
  const n = reviews.length;
  const early = average(reviews.slice(0, 3));
  const late = average(reviews.slice(Math.max(n - 3, 0)));
  const verdict = late < early ? "observed" : "not observed";
  const line =
    `depth ${label}: files 1-3 avg ${early.toFixed(1)}, files ${n - 2}-${n} avg ${late.toFixed(1)}` +
    ` — drop-off ${verdict}`;
  logObservation(line);
  return line;
}

/** Step 2: what the single pass found, file by file, with the lines it pointed at. */
export function singlePassTable(files: SourceFile[], reviews: FileReview[]): string {
  const widths = [8, 22, 8];
  const lines = [row(["position", "file", "findings", "line refs"], widths)];
  // reviews[i] is file i: single-pass.ts aligns its answer to the file order.
  files.forEach((file, i) => {
    const issues = reviews[i].issues;
    const refs = issues.length === 0 ? "-" : issues.map((x) => x.line).join(", ");
    lines.push(row([String(file.position), file.name, String(issues.length), refs], widths));
  });
  return lines.join("\n");
}

/** Behaviour 4: the issues only a pass over the summaries can see. */
function integrationSection(issues: CrossFileIssue[]): string {
  const lines = ["Cross-file issues (integration pass)"];
  if (issues.length === 0) return [...lines, "  (none)"].join("\n");
  for (const issue of issues) lines.push(`  [${issue.category}] ${issue.files.join(", ")}: ${issue.description}`);
  return lines.join("\n");
}

/** Per-file counts, totals and spread. Multi-pass total = local findings + integration issues. */
function countsSection(input: ComparisonInput): string {
  const { files, single, local, integration } = input;
  const widths = [8, 22, 11];
  const lines = ["Comparison", "  " + row(["position", "file", "single-pass", "multi-pass (local)"], widths)];
  files.forEach((file, i) => {
    // Both arrays are in file order, one entry per file. A file the single pass skipped
    // shows 0, the same as a clean file: from the reader's side, a skip finds nothing.
    const cells = [String(file.position), file.name, String(single[i].issues.length), String(local[i].issues.length)];
    lines.push("  " + row(cells, widths));
  });

  const singleTotal = single.reduce((n, r) => n + r.issues.length, 0);
  const localTotal = local.reduce((n, r) => n + r.issues.length, 0);
  const multiTotal = localTotal + integration.length;
  lines.push("");
  lines.push(`  single-pass total: ${singleTotal}`);
  lines.push(`  multi-pass total:  ${multiTotal} (${localTotal} local + ${integration.length} cross-file)`);
  lines.push(`  spread (max - min findings per file): single-pass ${spread(single)}, multi-pass ${spread(local)}`);

  const observation = `multi-pass total (local + cross-file) >= single-pass total: ${multiTotal >= singleTotal ? "observed" : "not observed"}`;
  logObservation(observation);
  lines.push(`  ${observation}`);
  return lines.join("\n");
}

/**
 * A seed counts for multi-pass when the local pass flagged its line or the integration pass
 * named both files. A local pass may flag a cross-file call site as suspicious on its own,
 * which still counts for the pipeline; the integration pass's own share is listed separately.
 */
function caughtByMultiPass(seed: SeededIssue, local: LocalReview[], integration: CrossFileIssue[]): boolean {
  if (seed.kind === "local") return caught(seed, local);
  return caughtByIntegration(seed, integration) || caught(seed, local);
}

/** Planted bugs found, not just findings counted: a long list is not the same as the right list. */
function seededSection(input: ComparisonInput): string {
  if (!input.keyApplies) return "Seeded issues: n/a (no answer key for this directory)";
  const { single, local, integration } = input;
  const widths = [4, 26, 52, 11];
  const lines = ["Seeded issues caught", "  " + row(["id", "file:line", "description", "single-pass", "multi-pass"], widths)];
  let singleCount = 0;
  let multiCount = 0;
  for (const seed of SEEDED) {
    const bySingle = caught(seed, single);
    const byMulti = caughtByMultiPass(seed, local, integration);
    singleCount += bySingle ? 1 : 0;
    multiCount += byMulti ? 1 : 0;
    const cells = [seed.id, `${seed.file}:${seed.line}`, seed.description, yesNo(bySingle), yesNo(byMulti)];
    lines.push("  " + row(cells, widths));
  }
  lines.push("");
  lines.push(`  single-pass caught ${singleCount}/${SEEDED.length}, multi-pass caught ${multiCount}/${SEEDED.length}`);

  // The integration pass's own contribution: bugs the single pass missed and only the summaries exposed.
  const onlyIntegration = SEEDED.filter(
    (s) => s.kind === "cross_file" && caughtByIntegration(s, integration) && !caught(s, single)
  );
  lines.push("  Cross-file issues found only by the integration pass:");
  if (onlyIntegration.length === 0) lines.push("    (none)");
  for (const s of onlyIntegration) lines.push(`    ${s.id} ${s.file}:${s.line} ${s.description}`);
  return lines.join("\n");
}

/** Step 5: the full comparison, as one block of text for stdout. */
export function comparisonReport(input: ComparisonInput): string {
  return [integrationSection(input.integration), countsSection(input), seededSection(input)].join("\n\n");
}
