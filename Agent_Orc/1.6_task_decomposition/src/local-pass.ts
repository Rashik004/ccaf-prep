// local-pass.ts — Step 3: the first stage of the chain. One call per file, each in its own context.
//
// A file reviewed alone has the model's full attention, wherever it sits in the
// directory: file 10 gets the same scrutiny as file 1. That is the structural fix for
// attention dilution. A bigger model or a longer prompt would still put all files in
// one context; splitting the work removes the competition.
//
// A local pass cannot see another file, so it cannot find a bug that lives between two
// files. It records the file's interface instead (exports and cross-module calls), and
// that summary is what the integration pass (Step 4) works from.

import type Anthropic from "@anthropic-ai/sdk";
import { sameFile } from "./answer-key";
import { numbered } from "./load-directory";
import { checkFailed, log, logCheck, logPassStart } from "./log";
import { reviewCall } from "./review-call";
import { LOCAL_PASS_SCHEMA, REVIEWER_SYSTEM } from "./schemas";
import type { LocalReview, SourceFile } from "./types";

function localPassRequest(file: SourceFile): string {
  return [
    `Review this one file.`,
    `Also describe its interface, for a later reviewer who will not see the source:`,
    `- exports: each exported function's signature and behaviour (units of the result, what happens when nothing is found).`,
    `- calls: each call into another module of the repo, with its line, callee, arguments as written, and what this caller expects back.`,
    "",
    numbered(file),
  ].join("\n");
}

export async function localPasses(
  client: Anthropic,
  model: string,
  files: SourceFile[]
): Promise<LocalReview[]> {
  logPassStart("Step 3: local passes (one call per file)");
  const reviews: LocalReview[] = [];

  // Within stage 1 the calls are independent (no call reads another's output), so they
  // could run in parallel; they run one after another only to keep the log readable.
  // Stage 2 must wait for all of them: that dependency is what makes this a chain.
  for (const file of files) {
    const review = await reviewCall<LocalReview>(client, {
      model,
      tag: `local-pass file=${file.name}`,
      system: REVIEWER_SYSTEM,
      user: localPassRequest(file),
      schema: LOCAL_PASS_SCHEMA,
    });
    reviews.push(review);
    log.out(`   [${file.position}] ${file.name}: ${review.issues.length} findings`);
  }

  // Checked once every file is in, so the log holds all N results before any failure.
  // Stage 2 must not start on a bad summary, so these run before integrationPass.
  checkSchemaValid(files, reviews);
  checkBugCounts(reviews);
  return reviews;
}

/** True when `r` has the LocalReview shape and reviews `file`. */
function isLocalReview(r: LocalReview, file: SourceFile): boolean {
  return (
    typeof r.file === "string" &&
    sameFile(r.file, file.name) &&
    Number.isInteger(r.bug_count) &&
    Array.isArray(r.issues) &&
    r.issues.every((i) => Number.isInteger(i.line) && typeof i.description === "string") &&
    Array.isArray(r.exports) &&
    Array.isArray(r.calls)
  );
}

/**
 * Structured outputs already guarantee the shape, so this is a guard, not a parser.
 * It also catches what the schema cannot: a summary whose `file` names a different file.
 * The integration pass trusts these summaries, so a wrong one must stop the run here.
 */
function checkSchemaValid(files: SourceFile[], reviews: LocalReview[]) {
  const bad = files.filter((file, i) => !isLocalReview(reviews[i], file));
  const ok = files.length - bad.length;
  if (bad.length > 0) {
    checkFailed("Step 3 (local passes)", "local-pass schema-valid", `${ok}/${files.length} valid; bad: ${bad.map((f) => f.name).join(", ")}`);
  }
  logCheck(`local-pass schema-valid ${ok}/${files.length}`);
}

/** bug_count must equal the number of issues: a rule the JSON Schema cannot express. */
function checkBugCounts(reviews: LocalReview[]) {
  const wrong = reviews.find((r) => r.bug_count !== r.issues.length);
  if (wrong) {
    checkFailed("Step 3 (local passes)", "bug_count==issues.length", `${wrong.file}: bug_count=${wrong.bug_count}, issues=${wrong.issues.length}`);
  }
  logCheck("bug_count==issues.length");
}
