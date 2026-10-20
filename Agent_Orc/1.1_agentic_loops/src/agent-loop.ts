// agent-loop.ts — Steps 2, 3, 4 and 6: the agentic loop.
//
// The loop is plain code. Each turn it sends the whole conversation to Claude
// and reads one field of the response, stop_reason:
//   "tool_use" → Claude wants tools run: run them, append the results, go again.
//   "end_turn" → Claude has finished: return its text.
// Nothing else ends the loop. Not a phrase like "I'm done" in the text, and not
// the presence of a text block: Claude often writes "Let me look that up" in the
// same response as a tool_use block. The iteration cap is a safety net only.

import type Anthropic from "@anthropic-ai/sdk";
import { checkToolResultIds } from "./checks";
import {
  logAppended,
  logAssistantText,
  logCapHit,
  logIteration,
  logLoopExit,
  logLoopStart,
  logRequest,
  logResponse,
  logToolCall,
} from "./log";
import { runTool, TOOLS } from "./tools";
import type { LoopResult, ToolCall } from "./types";

/** Step 6: a normal task ends by stop_reason long before this. Hitting it means something is wrong. */
export const MAX_ITERATIONS = 20;

export async function runAgentLoop(
  client: Anthropic,
  model: string,
  prompt: string
): Promise<LoopResult> {
  // The API keeps no memory between calls: this array IS the conversation, and it is sent in full every time.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  const toolCalls: ToolCall[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  logLoopStart(model, MAX_ITERATIONS);

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    // Step 2: send the request. tool_choice is left at its default ("auto"), so Claude decides
    // whether to call a tool and which one, rather than following a sequence fixed in code.
    // max_tokens caps one response; 1024 is ample here. Running out shows up as stop_reason "max_tokens".
    // This object is the whole Messages API request body. It is logged now, before the
    // messages array grows, so the log shows exactly what this call sent.
    const request = { model, max_tokens: 1024, tools: TOOLS, messages };
    logRequest(iteration, request);
    const started = Date.now();
    const response = await client.messages.create(request);
    const ms = Date.now() - started;
    logResponse(iteration, response, ms);

    usage.input_tokens += response.usage.input_tokens; // run totals; response.usage is this call only
    usage.output_tokens += response.usage.output_tokens;
    // Text may come with tool_use blocks ("Let me search for that"). It is logged on every turn,
    // but returned only from the end_turn response: having text does not mean being done.
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    logIteration({
      iteration,
      max: MAX_ITERATIONS,
      stopReason: response.stop_reason,
      blockTypes: response.content.map((b) => b.type),
      usage: response.usage,
      ms,
    });
    logAssistantText(text);

    // Step 4: end_turn is Claude saying the task is complete. It is the only normal exit.
    if (response.stop_reason === "end_turn") {
      logLoopExit(iteration, MAX_ITERATIONS);
      return { text, iterations: iteration, toolCalls, usage };
    }

    // Any other value (max_tokens, refusal, ...) means "not finished, and not asking for a tool".
    // Each needs its own handling (raise max_tokens, report the refusal); this exercise does not
    // need them, so it stops loudly rather than treat the answer as complete or loop blindly.
    if (response.stop_reason !== "tool_use") {
      throw new Error(`Step 4 (stop_reason): unexpected stop_reason=${response.stop_reason}`);
    }

    // Step 3: run every tool_use block. A response can hold several, and each one needs its result.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      const out = runTool(block.name, block.input); // both tools are local, so no await
      const call: ToolCall = {
        iteration,
        id: block.id,
        name: block.name,
        input: block.input,
        output: out.content,
        isError: out.isError,
      };
      toolCalls.push(call);
      logToolCall(call);
      // tool_use_id ties this result to the request it answers.
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out.content, is_error: out.isError });
    }
    // Cannot fail as written; it guards the API rule (one result per tool_use id) against later edits.
    checkToolResultIds(toolUses, toolResults);

    // Append Claude's turn unchanged, then one user turn holding the tool_results. The assistant
    // turn is not rebuilt from its text: the tool_use blocks and their ids must stay, because each
    // tool_result refers back to one. Without both turns, the next request has no record of what
    // was asked or found.
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
    logAppended(toolResults.map((r) => r.tool_use_id), messages.length);
  }

  // Step 6: the for loop ran out without returning, so Claude kept asking for tools for MAX_ITERATIONS turns.
  logCapHit(MAX_ITERATIONS);
  throw new Error(`Step 6 (safety cap): MAX_ITERATIONS=${MAX_ITERATIONS} reached without end_turn`);
}
