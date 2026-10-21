# 1.6 Task Decomposition Strategies — result

Written from a run log. Sections 1 to 3 come from the log; sections 4 to 6 are the revision notes.

## 1. Run

- Command, from `Agent_Orc/1.6_task_decomposition`: `npm start -- 'sample-repo'`
- Date: 2026-10-22, 00:10:38 local (log L4 `started: 2026-10-21T18:10:38.659Z`)
- Exit code: 0
- Log: `Log/20261022-001038_run.log` (2,429 lines)
- Closing line (L2428): `■ 12 model calls, tokens in=27828 out=9406, model time 93670 ms`

The comparison table and the `Attention dilution artefacts` section go to stdout only (`src/index.ts:83`), so the log does not hold them. The excerpts of those sections below are quoted from this run's stdout.

## 2. Cost

- Model: `claude-sonnet-5-5` on all 12 calls. Messages API, structured output (`output_config.format` `json_schema`), no tools, no caching (`cache_creation_input_tokens` and `cache_read_input_tokens` are 0 in every call).
- Model calls: 12 (1 single-pass, 10 local passes, 1 integration). Every call stopped with `end_turn`.
- Tokens: 27,828 input, 9,406 output.
- **Total: $0.1497.** The API reports tokens, not USD. The rate is $2.00 input / $10.00 output per million tokens, the same rate as the 1.1 RESULT, from the claude-api skill's model table.
- Model time: 93,670 ms summed. Wall time was about 94 s, from the log file's mtime.

| # | Call | in | out | thinking (part of out) | ms | USD |
|---|---|---|---|---|---|---|
| 1 | single-pass | 4,602 | 1,002 | 0 | 8,971 | 0.01922 |
| 2 | local 01_db.ts | 1,641 | 556 | 0 | 6,703 | 0.00884 |
| 3 | local 02_product-repo.ts | 1,625 | 741 | 0 | 8,168 | 0.01066 |
| 4 | local 03_warehouse-repo.ts | 1,631 | 804 | 178 | 8,280 | 0.01130 |
| 5 | local 04_pricing.ts | 1,498 | 823 | 258 | 7,553 | 0.01123 |
| 6 | local 05_format.ts | 1,441 | 606 | 192 | 5,917 | 0.00894 |
| 7 | local 06_stock-service.ts | 1,549 | 893 | 221 | 8,885 | 0.01203 |
| 8 | local 07_supplier-client.ts | 1,500 | 517 | 199 | 5,234 | 0.00817 |
| 9 | local 08_reorder.ts | 1,574 | 499 | 0 | 5,524 | 0.00814 |
| 10 | local 09_report.ts | 1,568 | 932 | 0 | 8,615 | 0.01246 |
| 11 | local 10_sync-job.ts | 1,628 | 1,152 | 417 | 10,697 | 0.01478 |
| 12 | integration | 7,571 | 881 | 0 | 9,123 | 0.02395 |
| **Total** | | **27,828** | **9,406** | | **93,670** | **0.14972** |

| Stage | Calls | in | out | ms | USD |
|---|---|---|---|---|---|
| single-pass | 1 | 4,602 | 1,002 | 8,971 | 0.0192 |
| local passes | 10 | 15,655 | 7,523 | 77,576 | 0.1065 |
| integration | 1 | 7,571 | 881 | 9,123 | 0.0240 |

The multi-pass chain (local + integration) cost $0.1305, 6.8 times the single pass. Most of that is output: each local pass also writes an interface summary (`exports`, `calls`).

## 3. What happened

**Step 1: load directory.** L12-L22:

```
[1] F:\…\sample-repo\01_db.ts (30 lines)
…
[10] F:\…\sample-repo\10_sync-job.ts (31 lines)
✓ CHECK files>=10 PASS
```

L24: `✓ CHECK answer key matches sample-repo (9 seeded lines) PASS`

**Shared system prompt.** All 12 calls send the same one (L33):

> `You are a senior TypeScript reviewer.\nReport real bugs only: code that behaves wrongly at runtime, is unsafe, or breaks a caller.\nDo not report style, naming or missing comments.\nEach finding cites the exact line number from the numbered listing you were given.\nSeverity is one of critical, high, medium, low.`

**Step 2: single pass.** L27: `✓ CHECK single-pass request holds all 10 files PASS`. The user turn (L37, 9,300 chars) holds all ten `=== FILE <name> ===` blocks:

> `Review all 10 files below. Return one entry per file, in the order given, even when a file has no bugs.\n\n=== FILE 01_db.ts ===\n  1│ // Thin wrapper around the stock database driver. …`

L145: `→ model call [single-pass] stop_reason=end_turn in=4602 out=1002 8971 ms`. L259: `✓ CHECK single-pass calls==1 PASS`. Stdout:

```
position  file                    findings  line refs
1         01_db.ts                1         23
2         02_product-repo.ts      2         17, 27
3         03_warehouse-repo.ts    1         21
4         04_pricing.ts           0         -
5         05_format.ts            0         -
6         06_stock-service.ts     1         6
7         07_supplier-client.ts   0         -
8         08_reorder.ts           1         16
9         09_report.ts            2         18, 14
10        10_sync-job.ts          2         23, 30

depth single-pass: files 1-3 avg 1.3, files 8-10 avg 1.7 — drop-off not observed
```

**Step 3: local passes.** There are ten calls, and each user turn holds exactly one file. The prompt also asks for an interface description for the later reviewer (L282):

> `Review this one file.\nAlso describe its interface, for a later reviewer who will not see the source:\n- exports: each exported function's signature and behaviour (units of the result, what happens when nothing is found).\n- calls: each call into another module of the repo, with its line, callee, arguments as written, and what this caller expects back.`

Per-file findings: L466 `[1] 01_db.ts: 1 findings` … L1461 `[6] 06_stock-service.ts: 0 findings` … L2258 `[10] 10_sync-job.ts: 2 findings`. The local pass on 06 found no bug, but its `calls` entry recorded the evidence (L1446-1451):

> `"line": 6, "callee": "getStock from ./03_warehouse-repo", "arguments": "warehouseId, sku", "expects": "… Argument order is (warehouseId, sku), the reverse of this file's own function signature. …"`

L2259-L2261:

```
✓ CHECK local-pass schema-valid 10/10 PASS
✓ CHECK bug_count==issues.length PASS
◆ OBSERVED depth multi-pass: files 1-3 avg 2.0, files 8-10 avg 2.0 — drop-off not observed
```

**Step 4: integration pass.** L2264-L2265:

```
✓ CHECK integration input=summaries PASS
   input: 19606 chars of summaries vs 6842 chars of raw source
```

The user turn (L2275) holds the ten summary objects. It has no `│` and no `=== FILE` header, so no source got in:

> `Below are per-file summaries of a 10-file TypeScript repo, one per file,\neach with its local findings, its exports and its calls into other modules. You do not have the source.\nReport only issues that span two or more files, in three categories: …\nDo not repeat a bug that sits inside one file.`

L2363: `→ model call [integration] stop_reason=end_turn in=7571 out=881 9123 ms`. L2415-L2421:

```
✓ CHECK integration categories valid PASS
✓ CHECK integration issues name >=2 files PASS
   [api_consistency] 06_stock-service.ts, 03_warehouse-repo.ts: 06_stock-service.ts line 6 calls getStock(warehouseId, sku), but 03_warehouse-repo.ts exports getStock(sku: string, warehouseId: string). The arguments are swapped …
   [data_flow] 09_report.ts, 04_pricing.ts, 05_format.ts: 09_report.ts line 14 passes getUnitPrice(sku) * units to formatDollars. getUnitPrice returns integer cents (1299 = $12.99), but formatDollars expects dollars. …
   [data_flow] 10_sync-job.ts, 07_supplier-client.ts: 10_sync-job.ts line 22 treats a findSupplier miss as a throw … findSupplier resolves null on a miss and never throws. …
   [pattern_consistency] 02_product-repo.ts, 10_sync-job.ts, 09_report.ts: Async work is fire-and-forget in three files. …
   [pattern_consistency] 01_db.ts, 02_product-repo.ts, 03_warehouse-repo.ts, 04_pricing.ts, 07_supplier-client.ts: A lookup miss is signalled differently in each module. …
✓ CHECK model calls==12 PASS
```

**Step 5: compare.** Stdout:

```
Comparison
  position  file                    single-pass  multi-pass (local)
  1         01_db.ts                1            1
  2         02_product-repo.ts      2            3
  3         03_warehouse-repo.ts    1            2
  4         04_pricing.ts           0            2
  5         05_format.ts            0            0
  6         06_stock-service.ts     1            0
  7         07_supplier-client.ts   0            0
  8         08_reorder.ts           1            2
  9         09_report.ts            2            2
  10        10_sync-job.ts          2            2

  single-pass total: 10
  multi-pass total:  19 (14 local + 5 cross-file)
  spread (max - min findings per file): single-pass 2, multi-pass 3
  multi-pass total (local + cross-file) >= single-pass total: observed

Seeded issues caught
  id    file:line                   description                                           single-pass  multi-pass
  L1    01_db.ts:23                 SQL built by string concatenation                     yes          yes
  L2    02_product-repo.ts:17       find() result dereferenced without a null check       yes          yes
  L3    02_product-repo.ts:27       forEach(async) is not awaited: saveAll resolves before the saves  yes          yes
  L4    08_reorder.ts:16            off-by-one: loop reads one past the end               yes          yes
  L5    09_report.ts:18             missing await on saveReport                           yes          yes
  L6    10_sync-job.ts:30           forEach(async) is not awaited: syncAll resolves before the saves  yes          yes
  X1    06_stock-service.ts:6       getStock(sku, warehouseId) called with the arguments swapped  yes          yes
  X2    09_report.ts:14             price returned in cents, formatted as dollars         yes          yes
  X3    10_sync-job.ts:23           findSupplier returns null when not found; the caller expects a throw  yes          yes

  single-pass caught 9/9, multi-pass caught 9/9
  Cross-file issues found only by the integration pass:
    (none)
```

**Step 6: dilution artefacts.** Stdout:

```
Attention dilution artefacts
  pattern: items.forEach(async (i) => { await save(i); });
    single-pass 02_product-repo.ts:27 flagged; 10_sync-job.ts:30 flagged -> consistent
    multi-pass  02_product-repo.ts:27 flagged; 10_sync-job.ts:30 flagged -> consistent

  dilution artefact single-pass: not observed
  dilution artefact multi-pass: not observed
```

**Anomalies from the log analysis:**

- The single pass caught all three cross-file seeds (L203 06:6, L235 09:14, L246 10:23), so "found only by integration" is empty. A ten-file, 250-line repo is too small to dilute attention. The expected contrast did not appear at this size.
- Six local-pass responses hold a `"type": "thinking"` block with empty text and a signature (L805, 1005, 1201, 1394, 1596, 2190), although no request sends `thinking`. Their 178 to 417 thinking tokens count in `output_tokens`.
- The integration input is 2.9 times the size of the source it replaces (19,606 vs 6,842 chars). Summaries cost tokens; they do not save them.
- The comparison and dilution sections are not in the log, which carries only the `◆ OBSERVED` verdict lines (L2423-L2425).

## 4. Acceptance behaviours

1. **Load directory: SHOWN.** L12-L21 list `[i] <path> (<n> lines)` for all 10 files, and L22 is `✓ CHECK files>=10 PASS`.
2. **Single-pass review: SHOWN.**
   - L259 `✓ CHECK single-pass calls==1 PASS`.
   - The L37 request holds all 10 `=== FILE` blocks.
   - The per-file table is on stdout.
   - L270 `◆ OBSERVED depth single-pass: files 1-3 avg 1.3, files 8-10 avg 1.7 — drop-off not observed`.
3. **Per-file local passes: SHOWN.**
   - There are ten `[local-pass file=<name>]` calls (L433 … L2221).
   - L2259 `✓ CHECK local-pass schema-valid 10/10 PASS`, L2260 `✓ CHECK bug_count==issues.length PASS`.
   - L2261 `◆ OBSERVED depth multi-pass: files 1-3 avg 2.0, files 8-10 avg 2.0 — drop-off not observed`.
4. **Cross-file integration pass: SHOWN.**
   - L2264 `✓ CHECK integration input=summaries PASS`.
   - L2415 `✓ CHECK integration categories valid PASS`, L2416 `✓ CHECK integration issues name >=2 files PASS`.
   - The 5 issues are printed at L2417-L2421.
5. **Compare results: SHOWN on stdout, PARTLY in the log.**
   - The comparison table, the seeded-catch table (9/9 vs 9/9) and the "found only by integration: (none)" list are on stdout.
   - The log has only L2423 `◆ OBSERVED multi-pass total (local + cross-file) >= single-pass total: observed`.
6. **Dilution artefacts: SHOWN on stdout, PARTLY in the log.**
   - The `Attention dilution artefacts` section on stdout has `consistent` for both approaches.
   - The log has only L2424 `◆ OBSERVED dilution artefact single-pass: not observed` and L2425 `… multi-pass: not observed`.

## 5. Study points

- **Pick the decomposition shape from how predictable the task is.** Use a fixed sequential pipeline (prompt chaining) when the steps are known up front and the input is structured: multi-aspect code review, extraction, compliance checks. A pipeline gives consistent output and is easy to log and debug step by step, but it cannot change course. Use dynamic adaptive decomposition when the scope is unknown: exploring a legacy codebase, debugging an unfamiliar system, "add comprehensive tests to a legacy codebase". It finds more, but its time and cost are hard to predict. On the exam, "more sophisticated" is not a reason to pick it.
- **Open-ended tasks follow a fixed recipe.** Map the structure first, then find the high-impact areas, then write a prioritised plan that changes as dependencies turn up. This exercise builds only the pipeline side, so learn the adaptive side from the task statement.
- **Attention dilution is the failure the review chain fixes.** When one pass covers many files, the early files get deep analysis and the later ones get skimmed, and the same code gets a different verdict in different files. A bigger context window, a stronger model or a longer prompt does not fix it, because all the files still share one pass. Sample Question 12 is this exact case: the answer is per-file passes plus an integration pass. The distractors are "split the PR" (moves the work to developers), "bigger model" and "flag only what 2 of 3 runs agree on" (hides bugs that are caught only some of the time).
- **The chain is per-file local passes, then one cross-file integration pass over the summaries.** Each local pass is a fresh Messages API call that sees one file. The integration pass sees only the ten summaries, never the source (`✓ CHECK integration input=summaries PASS`, L2264). It looks for three things: data flow, API consistency and pattern consistency.
- **Each local summary has to carry interface facts, not just bugs.** In this run the local pass on `06_stock-service.ts` found 0 bugs, but its `calls` entry recorded `"Argument order is (warehouseId, sku), the reverse of this file's own function signature"` (L1446-1451). The integration pass turned that into the `api_consistency` finding on 06 and 03. If the summary had listed only findings, that evidence would have been lost. The integration pass can only find what the summaries pass on to it.
- **Chaining buys attention, not tokens.** The integration input was 19,606 chars of summaries against 6,842 chars of raw source. The chain cost $0.1305, 6.8 times the single pass, mostly in output tokens spent writing the summaries. The cost grows with the file count (N+1 calls). Justify the pattern by consistency and depth, never by cost.
- **At this size, dilution did not show up.** The single pass caught 9/9 seeded issues, including all three cross-file ones, and showed no drop-off by file position (`files 1-3 avg 1.3, files 8-10 avg 1.7`). It also gave the repeated `forEach(async)` snippet the same verdict in both files. Ten files of about 250 lines are too few to dilute attention. Read this as "dilution depends on volume", not as a disproof. The exam scenario has 14 files in a real PR. Multi-pass did report more (19 vs 10), but beyond the seeds, those extra findings were not checked for precision.
- **1.6 vs 4.6.** Task 4.6 tests the same per-file + integration split from the review-quality side (independent instances, contradictory findings). 1.6 tests it as a decomposition choice: pipeline vs adaptive. Expect the same scenario in both domains.
- **1.6 vs 1.2 / 1.3.** 1.6 is about how the work is split. 1.2 is about who splits it: a coordinator that decides at runtime. 1.3 is about what context each worker gets. The local passes here are isolated fresh-context calls, the 1.3 idea, but the program's code fixes their order, so no coordinator decides anything. Sample Question 7 (a coordinator that split "creative industries" into visual arts only) is the crossover: a decomposition that is too narrow at the top limits what every worker below it can cover.
- **1.6 vs 1.4.** The pipeline's step order here is guaranteed by code (`src/index.ts` runs the steps in sequence), not by the prompt. That is the 1.4 point: when the order matters, enforce it in code.

## 6. Open questions and next tries

- **Scale until dilution shows.** Grow `sample-repo/` to 25–30 files, or pad each file to about 150 lines, and keep the seeds in the last files. Watch the `depth single-pass` line for `drop-off observed` and the `Cross-file issues found only by the integration pass` list.
- **Move the identical `forEach(async)` snippet to the first and last file of a larger repo.** Watch the `Attention dilution artefacts` section for `ARTEFACT` on the single pass.
- **Strip `exports`/`calls` from the local-pass schema** (`src/schemas.ts`, `src/local-pass.ts`) and rerun. Does the integration pass still find X1 (the swapped `getStock` arguments)? The expectation is no, which would show that the summary has to carry the interface.
- **Check the precision of the extra multi-pass findings.** `04_pricing.ts` got 2 local findings vs 0 in the single pass. Read its local-pass response in the log and decide whether they are real bugs or false positives.
- **Rerun the single pass 3 times.** Count how often it still catches all three cross-file seeds, to see whether 9/9 was stable or lucky.
- **Run the ten local passes with `Promise.all`.** Compare the wall time (about 94 s now) and check the findings stay the same. Independent passes are safe to parallelise (a link to 1.3).
- **Explain the unrequested thinking blocks.** Six local-pass responses carried empty `thinking` blocks (178–417 tokens counted in `output_tokens`) although no request sent `thinking`. Check the docs for the model's default, set thinking off explicitly, and compare the output tokens.
- **Sketch the adaptive counterpart.** Let the integration pass return "re-review file X for Y" requests that trigger another local pass. Compare the call count and the findings with the fixed chain. This is the pipeline-vs-dynamic contrast the exercise does not build.
