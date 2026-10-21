// log.ts — this lesson's trace events, on top of the shared run log in common/.
//
// The shared log owns the file in Log/ and the stderr trace. This file names the
// moments the lesson is about: each file read, each model call with its pass tag
// (single-pass, local-pass, integration), the checks, and the observations.
//
// Where each shared-log method writes. Nothing here goes to stdout.
//   headline   stderr and file, always: checks, observations and model calls use it
//   out        stderr and file; stderr is silenced by DEBUG_TRACE=0
//   record     file only, as full JSON
//   banner, finished, runError   opening, closing and failure blocks, written like headline

import { openRunLog } from "../../../common/log";
import type { CallStats, SourceFile, Usage } from "./types";

// Log/ sits in the exercise folder, next to src/, whatever the cwd.
export const log = openRunLog(new URL("../", import.meta.url));

/** A pass starts. The tag names the decomposition step the calls below belong to. */
export function logPassStart(title: string) {
  log.headline(`\n▶ ${title}`);
}

/** Step 1: one line per file, in review order. */
export function logFileRead(file: SourceFile) {
  log.out(`   [${file.position}] ${file.path} (${file.lines} lines)`);
}

/** A check passed. A failed check throws instead, and the run ends. */
export function logCheck(line: string) {
  log.headline(`✓ CHECK ${line} PASS`);
}

/** A check failed: logged as FAIL, then thrown so the run ends non-zero. `step` names the behaviour. */
export function checkFailed(step: string, check: string, detail: string): never {
  log.headline(`✗ CHECK ${check} FAIL — ${detail}`);
  throw new Error(`${step}: CHECK ${check} FAIL — ${detail}`);
}

/** Model-behaviour outcome: reported, never asserted, because a run may or may not show it. */
export function logObservation(line: string) {
  log.headline(`◆ OBSERVED ${line}`);
}

/** Logged before the call, so a failed call still leaves its request in the file. */
export function logRequest(tag: string, request: unknown) {
  log.record(`[${tag}] request (messages.create)`, request);
}

/** The response as received: content blocks, stop_reason, usage. */
export function logResponse(tag: string, response: unknown, ms: number) {
  log.record(`[${tag}] response (${ms} ms)`, response);
}

/** One headline per model call: which pass, what it cost, why it stopped. */
export function logModelCall(tag: string, stopReason: string | null, usage: Usage, ms: number) {
  log.headline(
    `   → model call [${tag}] stop_reason=${stopReason} ` +
      `in=${usage.input_tokens} out=${usage.output_tokens} ${ms} ms`
  );
}

/** The parsed JSON a pass got back, in full. */
export function logParsed(tag: string, parsed: unknown) {
  log.record(`[${tag}] parsed output`, parsed);
}

/** Token totals across every model call of the run. */
export function logTotals(calls: CallStats[]) {
  const input = calls.reduce((n, c) => n + c.usage.input_tokens, 0);
  const output = calls.reduce((n, c) => n + c.usage.output_tokens, 0);
  const ms = calls.reduce((n, c) => n + c.ms, 0);
  log.finished(`${calls.length} model calls, tokens in=${input} out=${output}, model time ${ms} ms`);
}
