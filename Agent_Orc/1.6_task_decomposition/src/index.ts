// index.ts — entry point: reviews one directory two ways, prints the comparison
// Usage: npm start -- sample-repo        (any directory of 10+ .ts/.js files)
//
// "Step N" in comments and error messages refers to the lesson's Build Exercise steps:
//   1  read a directory of 10+ source files                    → load-directory.ts
//   2  single-pass review: all files in one call (baseline)    → single-pass.ts
//   3  local passes: one call per file, structured output       → local-pass.ts
//   4  integration pass over the per-file summaries             → integration-pass.ts
//   5  compare the two approaches                              → compare.ts
//   6  record identical code judged differently (dilution)     → dilution.ts
//
// Words used throughout:
//   pass        one kind of model call: single-pass, local-pass, integration
//   multi-pass  the pipeline of Steps 3 and 4: stage 1 = the local passes, stage 2 = the
//               integration pass, which reads stage 1's output. A fixed sequence of calls
//               set in code (prompt chaining), not a plan the model makes up as it goes.
//   CHECK       a rule the program controls (call counts, schema, input): throws on failure
//   OBSERVED    a model-quality outcome (drop-off, artefacts): reported, never thrown,
//               because a run that shows no difference is still a valid result

import Anthropic from "@anthropic-ai/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAnthropicApiKey, loadAnthropicModel } from "../../../common/env";
import { answerKeyApplies } from "./answer-key";
import { comparisonReport, depthLine, singlePassTable } from "./compare";
import { dilutionReport } from "./dilution";
import { integrationPass } from "./integration-pass";
import { loadDirectory } from "./load-directory";
import { localPasses } from "./local-pass";
import { checkFailed, log, logCheck, logTotals } from "./log";
import { calls } from "./review-call";
import { singlePassReview } from "./single-pass";

// The seeded repo next to src/, used when no directory is given.
const SAMPLE_REPO = fileURLToPath(new URL("../sample-repo", import.meta.url));
// The Messages API needs a model name; this is the example.env value.
const FALLBACK_MODEL = "claude-sonnet-5-5";

async function main() {
  const arg = process.argv[2];
  const dir = arg ? resolve(arg) : SAMPLE_REPO;
  // Puts ANTHROPIC_API_KEY in process.env, where new Anthropic() reads it; returns only where it came from.
  const keySource = loadAnthropicApiKey();
  const model = loadAnthropicModel() ?? FALLBACK_MODEL;
  log.banner(`review ${dir}`, { started: new Date().toISOString(), key: `from ${keySource}`, model });
  const client = new Anthropic();

  // Step 1. Then the answer key that Step 5 scores against (planted bugs in sample-repo/,
  // see answer-key.ts) is checked against the files now, before any paid call, so a stale
  // key fails for free.
  const files = loadDirectory(dir);
  const keyApplies = answerKeyApplies(files);

  // Step 2: the baseline the lesson warns against.
  // depthLine also logs its line as an OBSERVED outcome; the text is printed with the report.
  const single = await singlePassReview(client, model, files);
  const singleDepth = depthLine("single-pass", single);

  // Steps 3 and 4: the multi-pass pipeline. Stage 2 consumes stage 1's summaries.
  const local = await localPasses(client, model, files);
  const multiDepth = depthLine("multi-pass", local);
  const integration = await integrationPass(client, model, local, files);

  // The decomposition's shape, counted: 1 single-pass call + N local calls + 1 integration
  // call, and no others. Runs after the calls, so it catches a stray call; it prevents none.
  const expected = files.length + 2;
  if (calls.length !== expected) {
    checkFailed("Steps 2-4 (call count)", `model calls==${expected}`, `made ${calls.length}`);
  }
  logCheck(`model calls==${expected}`);

  // Steps 5 and 6
  const report = [
    "Single-pass review (Step 2)",
    singlePassTable(files, single),
    singleDepth,
    multiDepth,
    comparisonReport({ files, single, local, integration, keyApplies }),
    dilutionReport(single, local, keyApplies),
  ].join("\n\n");

  console.log(report); // the program's result is the only thing on stdout
  logTotals(calls);
}

main().catch((err) => {
  log.runError(err);
  console.error(err instanceof Error ? err.message : err);
  console.error(`\nFull run log: ${log.file}`);
  process.exit(1);
});
