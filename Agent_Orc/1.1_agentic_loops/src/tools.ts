// tools.ts — Step 1: the two tools Claude can choose from, and the code that runs them.
//
// Claude never runs a tool. It answers with a tool_use block naming one of these
// tools and its input; runTool() below does the work, and the loop sends the
// output back as a tool_result. Two tools, not one, so Claude has to decide
// from context which comes next: that choice is the model-driven part.

import type Anthropic from "@anthropic-ai/sdk";
import { evaluate } from "./calculator";
import type { ToolOutput } from "./types";

/**
 * Sent with every request. input_schema is JSON Schema: Claude writes its tool input
 * to fit it, but nothing enforces that here, so runTool() still guards bad input.
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "calculator",
    description:
      "Evaluates an arithmetic expression and returns the numeric result. Use it for any " +
      "arithmetic. Supports numbers, + - * / and parentheses, e.g. \"5600000 * 0.1\". " +
      "Write numbers without thousands separators.",
    input_schema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "The arithmetic expression to evaluate." },
      },
      required: ["expression"],
    },
  },
  {
    name: "web_search",
    description:
      "Searches the web and returns a list of results, each with a title and a snippet. " +
      "Use it to look up facts you do not know, such as current figures.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
      },
      required: ["query"],
    },
  },
];

/**
 * Stub search: one fixed mock result, so the run is repeatable and the checks know the value.
 * Any other query gets an empty list. That is a normal "no results", not an error, and
 * Claude can rephrase and search again.
 */
function webSearch(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("norway") && q.includes("population")) {
    return JSON.stringify([
      {
        title: "Norway population (mock)",
        snippet: "Norway's population is 5,600,000 (mock figure).",
      },
    ]);
  }
  return JSON.stringify([]);
}

/**
 * Runs the tool a tool_use block names. A failure becomes an is_error result, not a crash,
 * so Claude reads the error and can correct its input. The output is always a string
 * (JSON here), because that is what a tool_result's content carries.
 */
export function runTool(name: string, input: unknown): ToolOutput {
  // A missing field arrives as the string "undefined", which the calculator rejects as an error.
  const args = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "calculator":
        return { content: JSON.stringify({ result: evaluate(String(args.expression)) }), isError: false };
      case "web_search":
        return { content: webSearch(String(args.query)), isError: false };
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return { content: `Error: ${err instanceof Error ? err.message : err}`, isError: true };
  }
}
