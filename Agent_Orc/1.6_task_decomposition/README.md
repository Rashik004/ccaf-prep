# 1.6 Task Decomposition Strategies

Lesson: https://claudecertificationguide.com/learn/1-agentic-architecture/1-6-task-decomposition

The lesson teaches how to pick a decomposition shape: a fixed sequential pipeline (prompt chaining) for predictable multi-aspect work such as code review, dynamic adaptive decomposition for open-ended investigation. Reviewing many files in one pass causes attention dilution: early files get detailed feedback, later ones get skimmed, and identical code gets different verdicts. The fix is structural, not a bigger model or longer prompt: one local analysis pass per file, then a separate cross-file integration pass over the per-file summaries. This program reviews a seeded 10-file TypeScript repo both ways, single-pass and multi-pass, and compares depth per file, seeded bugs caught, cross-file issues and inconsistent verdicts on identical code.

Setup, API key and logging: see the [root README](../../README.md).

## What it builds

1. **Load directory.** Log lists every file read as `[i] <path> (<n> lines)`, then `CHECK files>=10 PASS`; fewer than 10 `.ts`/`.js` files logs `CHECK files>=10 FAIL` and exits non-zero.
2. **Single-pass review.** Log shows exactly one call tagged `single-pass` whose request holds all N files (`CHECK single-pass calls==1 PASS`); stdout prints a per-file table (position, file, findings, line refs) and a depth line `depth single-pass: files 1-3 avg X, files 8-10 avg Y`, with drop-off reported as `observed` or `not observed`.
3. **Per-file local passes.** Log shows N calls tagged `local-pass file=<name>`, each returning schema-valid JSON `{file, bug_count, issues[{line, severity, description}]}`; `CHECK local-pass schema-valid N/N PASS`, `CHECK bug_count==issues.length PASS`, and a `depth multi-pass:` line showing the last file got the same depth as the first.
4. **Cross-file integration pass.** Log shows one call tagged `integration` whose input is the N per-file summaries, not raw source (`CHECK integration input=summaries PASS`); every returned issue has category `data_flow`, `api_consistency` or `pattern_consistency`, names 2 or more files, and is printed.
5. **Compare results.** stdout prints a comparison table: total issues per approach, per-file counts for both, seeded issues caught by each (matched to the answer key by file and line ±2), and cross-file issues found only by the integration pass.
6. **Dilution artefacts.** stdout section `Attention dilution artefacts` lists each identical-pattern pair with the verdict per file for each approach, labelled `ARTEFACT` or `consistent`; reported as observed or not observed, not asserted.

## Run

```sh
npm install
npm start -- 'sample-repo'
```

Test inputs: `sample-repo/` holds 10 small TypeScript files for a stock-tracking module with seeded issues, listed in an answer key inside the exercise: local bugs in early and late files (null dereference on a `find()` result, SQL built by string concatenation, off-by-one loop, missing `await`); the identical snippet `items.forEach(async (i) => { await save(i); })` in file 02 and file 10; and three cross-file issues (`getStock(sku, warehouseId)` called with swapped arguments, prices returned in cents but formatted as dollars, a not-found `null` return where the caller expects a throw). Expected: 12 model calls (1 single-pass, 10 local, 1 integration), multi-pass total at least the single-pass total, all three cross-file issues found by the integration pass.

Cost of the example prompt: (from the RESULT.md run's log).

## What to watch for

## Troubleshooting

## Source files

| File | Role |
|---|---|
| `src/index.ts` | Entry point: runs Steps 1-6 in order, checks the total call count, prints the report on stdout. |
| `src/load-directory.ts` | Step 1: reads the directory in fixed order; `numbered()` is the one rendering of raw source every pass sees. |
| `src/schemas.ts` | The review contract: shared reviewer system prompt and the three structured-output JSON schemas. |
| `src/review-call.ts` | One Messages API call (fresh context) with structured output, logged in full; counts calls per pass tag. |
| `src/single-pass.ts` | Step 2: the baseline, all files in one call. |
| `src/local-pass.ts` | Step 3: chain stage 1, one call per file; each summary carries issues plus interface facts (exports, calls). |
| `src/integration-pass.ts` | Step 4: chain stage 2, one call over the summaries only; asserts no raw source got in. |
| `src/answer-key.ts` | Seeded bugs in `sample-repo/`, verified against the files at load, and the ±2-line matching rules. |
| `src/compare.ts` | Step 5: depth lines, single-pass table, comparison table, seeded issues caught. |
| `src/dilution.ts` | Step 6: identical code at two positions, verdict per approach, `ARTEFACT` or `consistent`. |
| `src/log.ts` | This lesson's trace events on top of `common/log.ts`. |
| `src/types.ts` | Shapes shared by the passes, the answer key and the report. |
| `sample-repo/` | Ten small stock-tracking files with the seeded local, cross-file and identical-pattern bugs. |
