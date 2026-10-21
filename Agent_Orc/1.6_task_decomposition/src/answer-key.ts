// answer-key.ts — the bugs planted in sample-repo/, and how a review is matched to them.
//
// The key lets the comparison count "seeded issues caught" instead of trusting issue
// totals alone: a long list of findings is not the same as finding the planted bugs.

import { basename } from "node:path";
import { checkFailed, log, logCheck } from "./log";
import type { CrossFileIssue, FileReview, IdenticalPattern, SeededIssue, SourceFile } from "./types";

/** A finding counts as hitting a seeded line when it points within this many lines of it. */
export const LINE_TOLERANCE = 2;

export const SEEDED: SeededIssue[] = [
  // Local bugs: visible inside one file. Two early in review order, two late.
  { id: "L1", kind: "local", file: "01_db.ts", line: 23, snippet: `WHERE sku = '" + sku`, description: "SQL built by string concatenation" },
  { id: "L2", kind: "local", file: "02_product-repo.ts", line: 17, snippet: "return product.name", description: "find() result dereferenced without a null check" },
  { id: "L3", kind: "local", file: "02_product-repo.ts", line: 27, snippet: "items.forEach(async", description: "forEach(async) is not awaited: saveAll resolves before the saves" },
  { id: "L4", kind: "local", file: "08_reorder.ts", line: 16, snippet: "i <= thresholds.length", description: "off-by-one: loop reads one past the end" },
  { id: "L5", kind: "local", file: "09_report.ts", line: 18, snippet: "  saveReport(lines);", description: "missing await on saveReport" },
  { id: "L6", kind: "local", file: "10_sync-job.ts", line: 30, snippet: "items.forEach(async", description: "forEach(async) is not awaited: syncAll resolves before the saves" },
  // Cross-file bugs: each file looks fine alone; the bug is the mismatch between them.
  // `file` is the call site, `partner` the module whose contract it breaks.
  { id: "X1", kind: "cross_file", file: "06_stock-service.ts", line: 6, snippet: "getStock(warehouseId, sku)", partner: "03_warehouse-repo.ts", description: "getStock(sku, warehouseId) called with the arguments swapped" },
  { id: "X2", kind: "cross_file", file: "09_report.ts", line: 14, snippet: "formatDollars(getUnitPrice(sku) * units)", partner: "04_pricing.ts", description: "price returned in cents, formatted as dollars" },
  { id: "X3", kind: "cross_file", file: "10_sync-job.ts", line: 23, snippet: "supplier.email", partner: "07_supplier-client.ts", description: "findSupplier returns null when not found; the caller expects a throw" },
];

/** Byte-identical code in an early and a late file: the attention-dilution probe of Step 6. */
export const IDENTICAL_PATTERNS: IdenticalPattern[] = [
  {
    pattern: "items.forEach(async (i) => { await save(i); });",
    sites: [
      { file: "02_product-repo.ts", line: 27 },
      { file: "10_sync-job.ts", line: 30 },
    ],
  },
];

/**
 * True when the directory under review is sample-repo: every keyed file is present.
 * A keyed file whose line no longer holds its snippet means the repo was edited
 * and the key is stale, so the run stops rather than report wrong catches.
 */
export function answerKeyApplies(files: SourceFile[]): boolean {
  const byName = new Map(files.map((f) => [f.name, f]));
  if (!SEEDED.every((s) => byName.has(s.file))) {
    log.headline("   answer key: not this directory (seeded columns show n/a)");
    return false;
  }
  for (const seed of SEEDED) {
    const text = byName.get(seed.file)!.text.split("\n")[seed.line - 1] ?? "";
    if (!text.includes(seed.snippet)) {
      checkFailed("Step 5 (answer key)", "answer key matches sample-repo", `${seed.id} expects "${seed.snippet}" at ${seed.file}:${seed.line}`);
    }
  }
  logCheck(`answer key matches sample-repo (${SEEDED.length} seeded lines)`);
  return true;
}

/** Models may answer with "sample-repo/02_x.ts" or "02_x.ts": compare by file name only. */
export function sameFile(a: string, b: string): boolean {
  return basename(a) === basename(b);
}

/** Did any review of `site.file` report an issue within LINE_TOLERANCE of `site.line`? */
export function flaggedAt(site: { file: string; line: number }, reviews: FileReview[]): boolean {
  return reviews
    .filter((r) => sameFile(r.file, site.file))
    .some((r) => r.issues.some((i) => Math.abs(i.line - site.line) <= LINE_TOLERANCE));
}

/** A seeded issue is caught by a per-file review when the review flags its line (same rule as flaggedAt). */
export function caught(seed: SeededIssue, reviews: FileReview[]): boolean {
  return flaggedAt(seed, reviews);
}

/**
 * A cross-file seed is caught by the integration pass when one issue names both of its files.
 * Files only, not wording: a loose but checkable rule. Read the printed issue to judge the match.
 */
export function caughtByIntegration(seed: SeededIssue, issues: CrossFileIssue[]): boolean {
  if (!seed.partner) return false;
  const partner = seed.partner;
  return issues.some(
    (i) => i.files.some((f) => sameFile(f, seed.file)) && i.files.some((f) => sameFile(f, partner))
  );
}
