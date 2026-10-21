// integration-pass.ts — Step 4: the second stage of the chain. One call over the summaries.
//
// Some bugs live between files: a call passes arguments in the wrong order, a price in
// cents is formatted as dollars, a caller expects a throw where the callee returns null.
// No local pass can see these. The integration pass reads every file's summary at once
// and compares each call against the export it targets.
//
// It reads summaries, never raw source. That keeps its context small (the summaries are a
// fraction of the code), so it does not reintroduce the dilution the local passes removed,
// and it keeps its job to the interfaces rather than re-reviewing every line.

import type Anthropic from "@anthropic-ai/sdk";
import { NUMBERED_LINE } from "./load-directory";
import { checkFailed, log, logCheck, logPassStart } from "./log";
import { reviewCall } from "./review-call";
import { INTEGRATION_SCHEMA, REVIEWER_SYSTEM } from "./schemas";
import type { CrossFileCategory, CrossFileIssue, LocalReview, SourceFile } from "./types";

// The schema's enum already restricts the category; checking it again is a guard.
const CATEGORIES: CrossFileCategory[] = ["data_flow", "api_consistency", "pattern_consistency"];

function integrationRequest(summaries: LocalReview[]): string {
  return [
    `Below are per-file summaries of a ${summaries.length}-file TypeScript repo, one per file,`,
    `each with its local findings, its exports and its calls into other modules. You do not have the source.`,
    `Report only issues that span two or more files, in three categories:`,
    `- data_flow: a value changes meaning on its way between files (units, null vs throw).`,
    `- api_consistency: a call does not match the signature or behaviour of the export it targets.`,
    `- pattern_consistency: the same job is done differently, or a bug is handled differently, across files.`,
    `Do not repeat a bug that sits inside one file.`,
    "",
    JSON.stringify(summaries, null, 2),
  ].join("\n");
}

export async function integrationPass(
  client: Anthropic,
  model: string,
  summaries: LocalReview[],
  files: SourceFile[]
): Promise<CrossFileIssue[]> {
  logPassStart("Step 4: cross-file integration pass (summaries only)");
  const user = integrationRequest(summaries);

  // The decomposition holds only if this pass works from summaries. One numbered source
  // line in the request would mean raw code leaked into the second stage.
  if (NUMBERED_LINE.test(user)) {
    checkFailed("Step 4 (integration pass)", "integration input=summaries", "request contains a numbered source line");
  }
  logCheck("integration input=summaries");
  // `files` is used only here, to measure how much smaller the input is. It is never sent.
  const sourceChars = files.reduce((n, f) => n + f.text.length, 0);
  log.out(`   input: ${user.length} chars of summaries vs ${sourceChars} chars of raw source`);

  const answer = await reviewCall<{ issues: CrossFileIssue[] }>(client, {
    model,
    tag: "integration",
    system: REVIEWER_SYSTEM,
    user,
    schema: INTEGRATION_SCHEMA,
  });

  checkIssues(answer.issues);
  for (const issue of answer.issues) {
    log.headline(`   [${issue.category}] ${issue.files.join(", ")}: ${issue.description}`);
  }
  return answer.issues;
}

/** A cross-file issue must have a known category and name at least two files. */
function checkIssues(issues: CrossFileIssue[]) {
  const badCategory = issues.findIndex((i) => !CATEGORIES.includes(i.category));
  if (badCategory >= 0) {
    checkFailed("Step 4 (integration pass)", "integration categories valid", `issue ${badCategory} has category ${issues[badCategory].category}`);
  }
  logCheck("integration categories valid");

  // The schema cannot say "two or more", so code says it: an issue in one file is a local finding.
  const singleFile = issues.findIndex((i) => i.files.length < 2);
  if (singleFile >= 0) {
    checkFailed("Step 4 (integration pass)", "integration issues name >=2 files", `issue ${singleFile} names ${issues[singleFile].files.length} file(s)`);
  }
  logCheck("integration issues name >=2 files");
}
