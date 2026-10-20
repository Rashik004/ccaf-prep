// index.ts — entry point: reads arguments, runs the exercise, prints the result
// Usage: npm start -- "your prompt"

import { loadAnthropicApiKey, loadAnthropicModel } from "../../../common/env";
import { log } from "./log";

async function main() {
  const prompt = process.argv.slice(2).join(" ");
  log.banner(prompt || "(no prompt)", {
    started: new Date().toISOString(),
    key: loadAnthropicApiKey(),
    model: loadAnthropicModel() ?? "SDK default",
  });

  // TODO({{ID}}): one block per Build Exercise step. Log every model call and tool call in
  // full with log.record(): request as sent, response as received, usage, duration.
  const result = "";

  console.log(result); // the program's result is the only thing on stdout
  log.finished("done");
}

main().catch((err) => {
  log.runError(err);
  console.error(err instanceof Error ? err.message : err);
  console.error(`\nFull run log: ${log.file}`);
  process.exit(1);
});
