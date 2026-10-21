// single-pass.ts — Step 2: the baseline. All files reviewed in one call, one context.
//
// This is the approach the lesson warns against. Every file competes for the model's
// attention in the same context, so files early in the listing tend to get detailed
// findings and files late in it get skimmed or skipped. The prompt and the per-file
// output shape match the local pass, so any difference comes from the context alone.

import type Anthropic from "@anthropic-ai/sdk";
import { sameFile } from "./answer-key";
import { numbered } from "./load-directory";
import { checkFailed, log, logCheck, logPassStart } from "./log";
import { callsTagged, reviewCall } from "./review-call";
import { REVIEWER_SYSTEM, SINGLE_PASS_SCHEMA } from "./schemas";
import type { FileReview, SourceFile } from "./types";

const TAG = "single-pass";

function singlePassRequest(files: SourceFile[]): string {
  const ask =
    `Review all ${files.length} files below. Return one entry per file, in the order given, ` +
    `even when a file has no bugs.`;
  return [ask, ...files.map(numbered)].join("\n\n");
}

/** A file the model left out gets an empty review. That is dilution evidence, not an error. */
function alignToFiles(files: SourceFile[], returned: FileReview[]): FileReview[] {
  return files.map((file) => {
    const review = returned.find((r) => sameFile(r.file, file.name));
    if (review) return review;
    log.out(`   single-pass returned no entry for ${file.name}`);
    return { file: file.name, bug_count: 0, issues: [] };
  });
}

export async function singlePassReview(
  client: Anthropic,
  model: string,
  files: SourceFile[]
): Promise<FileReview[]> {
  logPassStart(`Step 2: single-pass review (all ${files.length} files in one call)`);
  const user = singlePassRequest(files);

  // The baseline is only fair if every file really is in the one context.
  const missing = files.filter((f) => !user.includes(`=== FILE ${f.name} ===`));
  if (missing.length > 0) {
    checkFailed("Step 2 (single-pass)", `single-pass request holds all ${files.length} files`, `missing ${missing.map((f) => f.name).join(", ")}`);
  }
  logCheck(`single-pass request holds all ${files.length} files`);

  const answer = await reviewCall<{ files: FileReview[] }>(client, {
    model,
    tag: TAG,
    system: REVIEWER_SYSTEM,
    user,
    schema: SINGLE_PASS_SCHEMA,
  });

  // One call is what makes this the single-pass baseline.
  const count = callsTagged(TAG);
  if (count !== 1) {
    checkFailed("Step 2 (single-pass)", "single-pass calls==1", `made ${count} calls`);
  }
  logCheck("single-pass calls==1");

  const reviews = alignToFiles(files, answer.files);
  files.forEach((file, i) => {
    log.out(`   [${file.position}] ${file.name}: ${reviews[i].issues.length} findings`);
  });
  return reviews;
}
