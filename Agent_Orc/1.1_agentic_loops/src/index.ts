// index.ts — entry point: registers the tools, runs the agentic loop, prints Claude's answer
// Usage: npm start -- "your prompt"
//
// "Step N" in comments and error messages refers to the lesson's Build Exercise steps:
//   1  register two tools (calculator, web_search)        → tools.ts
//   2  loop: call Claude, read stop_reason every turn       → agent-loop.ts
//   3  on "tool_use": run the tools, append tool_results    → agent-loop.ts
//   4  on "end_turn": exit and return the final text       → agent-loop.ts
//   5  test: a prompt that needs a search, then a calculation on its result → checks.ts
//   6  safety cap of 20 iterations, with a warning if hit  → agent-loop.ts

import Anthropic from "@anthropic-ai/sdk";
import { loadAnthropicApiKey, loadAnthropicModel } from "../../../common/env";
import { runAgentLoop } from "./agent-loop";
import { checkSequential, checkToolsRegistered } from "./checks";
import { log, logTools, logTotals } from "./log";
import { TOOLS } from "./tools";

const DEFAULT_PROMPT = "Search for the population of Norway, then calculate 10% of it.";
// The Messages API needs a model name; this is the example.env value.
const FALLBACK_MODEL = "claude-sonnet-5-5";

async function main() {
  const prompt = process.argv.slice(2).join(" ") || DEFAULT_PROMPT;
  // Puts ANTHROPIC_API_KEY in process.env, where new Anthropic() reads it; returns only where it came from.
  const keySource = loadAnthropicApiKey();
  // ANTHROPIC_MODEL from .env or the terminal wins; the fallback applies only when neither sets it.
  const model = loadAnthropicModel() ?? FALLBACK_MODEL;
  log.banner(prompt, { started: new Date().toISOString(), key: `from ${keySource}`, model });

  // Step 1: the two tools, logged in full and checked before the first call.
  logTools(TOOLS);
  checkToolsRegistered(TOOLS);

  // Steps 2-4 and 6: the loop runs until Claude stops with stop_reason "end_turn".
  const result = await runAgentLoop(new Anthropic(), model, prompt);

  // Step 5: the test prompt needs a search, then a calculation on what it found.
  checkSequential(result.toolCalls, result.text);

  console.log(result.text); // the program's result is the only thing on stdout
  logTotals(result.iterations, result.toolCalls.length, result.usage);
}

main().catch((err) => {
  log.runError(err);
  console.error(err instanceof Error ? err.message : err);
  console.error(`\nFull run log: ${log.file}`);
  process.exit(1);
});
