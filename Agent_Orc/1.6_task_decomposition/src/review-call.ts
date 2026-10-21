// review-call.ts — one Messages API call that returns parsed JSON.
//
// Every pass in this exercise is built from this one call. There is no agent loop and no
// tools: the program decides the sequence of calls (prompt chaining), and each call is a
// single request and a single response.

import type Anthropic from "@anthropic-ai/sdk";
import { logModelCall, logParsed, logRequest, logResponse } from "./log";
import type { CallStats } from "./types";

export interface ReviewCallInput {
  model: string;
  /** Names the pass in the log: "single-pass", "local-pass file=<name>", "integration". */
  tag: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

/** Every model call of the run, for the totals and the call-count checks. */
export const calls: CallStats[] = [];

/** How many calls so far carry a tag starting with `prefix` ("local-pass" matches every file's tag). */
export function callsTagged(prefix: string): number {
  return calls.filter((c) => c.tag.startsWith(prefix)).length;
}

/**
 * Each call is a fresh context. The API keeps no memory between calls, so the model sees
 * only what this request carries: one file for a local pass, all files for the single
 * pass, summaries for the integration pass. Decomposition is choosing what goes in here.
 */
export async function reviewCall<T>(client: Anthropic, input: ReviewCallInput): Promise<T> {
  // No thinking or effort settings: every pass runs on the model's defaults, so the only
  // variable is what goes into the context. max_tokens is generous because a cut-off
  // answer is truncated JSON.
  // output_config.format turns on structured outputs: the text block is JSON in the schema's shape.
  const request = {
    model: input.model,
    max_tokens: 16000,
    system: input.system,
    messages: [{ role: "user" as const, content: input.user }],
    output_config: { format: { type: "json_schema" as const, schema: input.schema } },
  };
  logRequest(input.tag, request);
  const started = Date.now();
  const response = await client.messages.create(request);
  const ms = Date.now() - started;
  logResponse(input.tag, response, ms);

  calls.push({ tag: input.tag, usage: response.usage, ms });
  logModelCall(input.tag, response.stop_reason, response.usage, ms);

  // end_turn is the only complete answer. max_tokens would mean the JSON was cut off;
  // refusal means there is no review. Either way there is nothing safe to parse, so the
  // whole run stops here rather than compare a partial review.
  if (response.stop_reason !== "end_turn") {
    throw new Error(`[${input.tag}] unexpected stop_reason=${response.stop_reason}`);
  }

  // The response may also hold thinking blocks; the answer is the text.
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = JSON.parse(text) as T;
  logParsed(input.tag, parsed);
  return parsed;
}
