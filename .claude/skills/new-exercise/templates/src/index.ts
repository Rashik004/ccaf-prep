// index.ts — entry point: reads arguments, runs the exercise, prints the result
// Usage: npm start -- "your prompt"

import { loadAnthropicApiKey, loadAnthropicModel } from "../../../common/env";
import { log } from "./log";

async function main() {
  log.banner(process.argv.slice(2).join(" ") || "(no prompt)", {
    started: new Date().toISOString(),
    key: loadAnthropicApiKey(),
    model: loadAnthropicModel() ?? "SDK default",
  });

  // TODO({{ID}}): one call per Build Exercise step; log each model and tool call with log.record().

  log.finished("done");
}

main().catch((err) => {
  log.runError(err);
  console.error(err instanceof Error ? err.message : err);
  console.error(`\nFull run log: ${log.file}`);
  process.exit(1);
});
