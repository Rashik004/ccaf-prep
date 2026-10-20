// log.ts — this lesson's trace events, on top of the shared run log in common/.
//
// The shared log owns the file in Log/ and the stderr trace. This file names the
// moments the lesson is about: each loop iteration and its stop_reason, each
// tool call, each append to the conversation history, and the checks.
//
// Where each shared-log method writes. Nothing here goes to stdout.
//   headline   stderr and file, always
//   out, quote stderr and file; stderr is silenced by DEBUG_TRACE=0
//   record     file only, as full JSON
//   finished   closing block, written like headline
// Opening the log at import creates no file; the first line written does.

import { openRunLog, safeJson } from "../../../common/log";
import type { ToolCall, Usage } from "./types";

// Log/ sits in the exercise folder, next to src/, whatever the cwd.
export const log = openRunLog(new URL("../", import.meta.url));

/** Step 1: both tool definitions, in full, as they are sent in every request. */
export function logTools(tools: unknown[]) {
  log.out(`\n🔧 ${tools.length} tools registered`);
  log.quote(safeJson(tools));
}

/** A check passed. A failed check throws instead, and the run ends. */
export function logCheck(line: string) {
  log.headline(`✓ CHECK ${line}`);
}

/** Step 6: the cap is fixed before the first call, so the log shows it up front. */
export function logLoopStart(model: string, max: number) {
  log.headline(`\n▶ agentic loop  model=${model}  MAX_ITERATIONS=${max}`);
}

/** Logged before the call, so a failed call still leaves its request in the file. */
export function logRequest(iteration: number, request: unknown) {
  log.record(`iteration ${iteration} request (messages.create)`, request);
}

/** The response as received: content blocks, stop_reason, usage. */
export function logResponse(iteration: number, response: unknown, ms: number) {
  log.record(`iteration ${iteration} response (${ms} ms)`, response);
}

/** Step 2: one line per model call. content=[...] shows text can sit next to tool_use. */
export function logIteration(info: {
  iteration: number;
  max: number;
  stopReason: string | null;
  blockTypes: string[];
  usage: Usage;
  ms: number;
}) {
  log.headline(
    `\n↻ iteration ${info.iteration}/${info.max}: messages.create -> ` +
      `stop_reason=${info.stopReason} content=[${info.blockTypes.join(",")}]`
  );
  log.out(
    `   usage: in=${info.usage.input_tokens} out=${info.usage.output_tokens}  ` +
      `duration: ${info.ms} ms`
  );
}

/** Text Claude wrote in this turn. It is not a completion signal, only stop_reason is. */
export function logAssistantText(text: string) {
  if (!text.trim()) return;
  log.out(`   🧠 assistant text:`);
  log.quote(text.trim());
}

/** Step 3: a tool_use block executed by our code. */
export function logToolCall(call: ToolCall) {
  log.headline(`   → tool call ${call.name} id=${call.id} input=${JSON.stringify(call.input)}`);
  log.out(`   ← tool result${call.isError ? " (is_error)" : ""}:`);
  log.quote(call.output);
  // The readable lines above are the trace; this is the complete call as data.
  log.record(`tool call ${call.name} ${call.id}`, call);
}

/** Step 3: the history grew by the assistant turn plus one user turn of tool_results. */
export function logAppended(toolUseIds: string[], messageCount: number) {
  log.out(
    `   appended assistant + user(tool_result tool_use_id=${toolUseIds.join(",")}) ` +
      `messages=${messageCount}`
  );
}

/** Step 4 (why the loop stopped) and Step 6 (the cap was not what stopped it). */
export function logLoopExit(iterations: number, max: number) {
  log.headline(`   stop_reason=end_turn -> loop exit`);
  log.headline(
    `loop ended by stop_reason=end_turn after ${iterations} iterations (cap ${max} not reached)`
  );
}

/** Step 6: the safety net fired. In a healthy run this line never appears. */
export function logCapHit(max: number) {
  log.headline(`⚠ WARN cap reached: MAX_ITERATIONS=${max} hit without stop_reason=end_turn`);
}

/** Token totals across every model call of the run. */
export function logTotals(iterations: number, toolCalls: number, usage: Usage) {
  log.finished(
    `${iterations} model calls, ${toolCalls} tool calls, ` +
      `tokens in=${usage.input_tokens} out=${usage.output_tokens}`
  );
}
