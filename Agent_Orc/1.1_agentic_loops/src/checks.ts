// checks.ts — the lesson's rules as code. Each check throws when the run breaks a rule.

import type Anthropic from "@anthropic-ai/sdk";
import { logCheck } from "./log";
import type { ToolCall } from "./types";

/** The value the web_search stub in tools.ts returns ("5,600,000"), without thousands separators. */
const SEARCH_VALUE = "5600000";
/** 10% of SEARCH_VALUE: the number the final answer must state. */
const EXPECTED_ANSWER = "560000";

/**
 * True when `text`, with separators removed, holds `value` as a whole number:
 * "5,600,000 * 0.1" matches 5600000; "56000000" and "5600000.5" do not.
 * The pattern requires no digit or "." right before the value, and no digit
 * or decimal part right after it.
 */
function mentionsNumber(text: string, value: string): boolean {
  const digits = text.replace(/[,_\s]/g, "");
  return new RegExp(`(?<![\\d.])${value}(?!\\.?\\d)`).test(digits);
}

/** Step 1: both tools are defined, each with an object input_schema and its required field. */
export function checkToolsRegistered(tools: Anthropic.Tool[]): void {
  const expected: Record<string, string> = { calculator: "expression", web_search: "query" };
  const names = tools.map((t) => t.name);
  if (tools.length !== 2 || !names.includes("calculator") || !names.includes("web_search")) {
    throw new Error(`Step 1 (tools registered): expected calculator and web_search, got [${names}]`);
  }
  for (const tool of tools) {
    const field = expected[tool.name];
    if (!tool.description || tool.input_schema.type !== "object" || !tool.input_schema.required?.includes(field)) {
      throw new Error(
        `Step 1 (tools registered): ${tool.name} needs a description and an object input_schema requiring "${field}"`
      );
    }
  }
  logCheck(`tools registered: ${names.join(", ")} (input_schema ok)`);
}

/**
 * Step 3: every tool_use block in the assistant turn is answered by exactly one
 * tool_result with the same id. A missing or extra result is a 400 from the API.
 */
export function checkToolResultIds(
  toolUses: Anthropic.ToolUseBlock[],
  toolResults: Anthropic.ToolResultBlockParam[]
): void {
  const asked = toolUses.map((b) => b.id).sort();
  const answered = toolResults.map((b) => b.tool_use_id).sort();
  if (asked.join() !== answered.join()) {
    throw new Error(
      `Step 3 (tool_result ids): tool_use ids [${asked}] but tool_result ids [${answered}]`
    );
  }
  logCheck(`tool_result ids match: ${answered.join(", ")}`);
}

/**
 * Step 5: the test prompt needed tools in sequence. Claude searched first, then
 * calculated with the value the search returned, across at least two iterations,
 * and the final answer states the calculated result.
 */
export function checkSequential(calls: ToolCall[], answer: string): void {
  // Iterations that ran at least one tool: two means two separate round trips to Claude.
  const toolIterations = new Set(calls.map((c) => c.iteration)).size;
  // Calculator calls made after the first search (none if there was no search).
  const firstSearch = calls.findIndex((c) => c.name === "web_search");
  const calcAfterSearch =
    firstSearch < 0 ? [] : calls.slice(firstSearch + 1).filter((c) => c.name === "calculator");
  // Did Claude carry the searched number into its calculation?
  const usedValue = calcAfterSearch.some((c) => {
    const { expression } = c.input as { expression?: unknown };
    return mentionsNumber(String(expression ?? ""), SEARCH_VALUE);
  });
  const order = calls.map((c) => c.name).join(" -> ");

  if (toolIterations < 2) {
    throw new Error(`Step 5 (sequential): only ${toolIterations} tool iteration(s): ${order || "(none)"}`);
  }
  if (calcAfterSearch.length === 0) {
    throw new Error(`Step 5 (sequential): no calculator call after web_search: ${order}`);
  }
  if (!usedValue) {
    throw new Error(`Step 5 (sequential): no calculator expression uses the search value ${SEARCH_VALUE}`);
  }
  logCheck(`sequential: ${toolIterations} tool iterations, ${order}, search value used`);

  // Wording varies run to run; this accepts "560,000" or "560000" but not "0.56 million".
  if (!mentionsNumber(answer, EXPECTED_ANSWER)) {
    throw new Error(`Step 5 (sequential): final answer does not state ${EXPECTED_ANSWER}`);
  }
  logCheck(`final answer states ${EXPECTED_ANSWER}`);
}
