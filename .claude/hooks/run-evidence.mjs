// run-evidence.mjs — PostToolUse hook on Bash and PowerShell: after an exercise run (npm start), puts the
// newest run log's summary in Claude's context and points at RESULT.md, so the run and its
// write-up stay one step apart. Advisory only: it never blocks.

import { join } from "node:path";
import { exerciseFolderFor, newestLog } from "./lib/exercise.mjs";
import { PROJECT_ROOT, addContext, readEvent, runHook } from "./lib/hook-io.mjs";
import { NPM_START, runDir, summariseLog } from "./lib/run-log.mjs";

// A log written this long before the hook fires is from an earlier run.
const FRESH_MS = 2 * 60 * 1000;

runHook("run-evidence", () => {
  const { tool_input: input, cwd } = readEvent();
  const command = typeof input?.command === "string" ? input.command : "";
  if (!NPM_START.test(command)) return;

  const folder = exerciseFolderFor(runDir(command, cwd || PROJECT_ROOT), PROJECT_ROOT);
  if (!folder) return; // npm start outside an exercise folder is not an exercise run

  if (input.run_in_background) {
    addContext("PostToolUse", `run-evidence: the exercise run is in the background. When it finishes, read the newest log in ${join(folder, "Log")} and update RESULT.md.`);
    return;
  }

  const log = newestLog(folder);
  const lines = [];
  if (!log) lines.push(`run-evidence: ${folder} has no Log/*.log. The run wrote no log; check that the entry point opens the run log.`);
  else {
    if (Date.now() - log.mtimeMs > FRESH_MS) {
      lines.push(`run-evidence: WARNING the newest log was last written ${new Date(log.mtimeMs).toISOString()}, before this run. This run may have written no log.`);
    }
    lines.push(...summariseLog(log.path, log.size));
  }
  lines.push("RESULT.md needs updating from this log: sections Run, Cost and What happened quote it (or use /run-exercise).");
  addContext("PostToolUse", lines.join("\n"));
});
