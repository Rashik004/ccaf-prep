// run-evidence.mjs — PostToolUse and PostToolUseFailure hook on Bash and PowerShell: after an
// exercise run (npm start), puts the newest run log's summary in Claude's context and points
// at RESULT.md, so the run and its write-up stay one step apart. A failed run (non-zero exit)
// arrives as PostToolUseFailure, and its log matters most. Advisory only: it never blocks.

import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { exerciseFolderFor, newestLog } from "./lib/exercise.mjs";
import { PROJECT_ROOT, addContext, readEvent, runHook } from "./lib/hook-io.mjs";
import { NPM_START, logOverride, runDir, summariseLog } from "./lib/run-log.mjs";

/** The log at `path` in newestLog's shape, or undefined when there is no file. */
function logAt(path) {
  if (!existsSync(path)) return undefined;
  const stat = statSync(path);
  return stat.isFile() ? { path, mtimeMs: stat.mtimeMs, size: stat.size } : undefined;
}

// Slack between the run's start (now minus its duration) and the log's first write.
const SLACK_MS = 5000;
// Without a duration, a log older than this is from an earlier run.
const FALLBACK_MS = 2 * 60 * 1000;

runHook("run-evidence", () => {
  const event = readEvent();
  const input = event.tool_input;
  const command = typeof input?.command === "string" ? input.command : "";
  if (!NPM_START.test(command)) return;
  const eventName = event.hook_event_name === "PostToolUseFailure" ? "PostToolUseFailure" : "PostToolUse";

  // The docs do not say whether the event cwd is taken before or after a cd in the command.
  // A command that moves (cd or --prefix) is resolved from its own path first; when that
  // lands outside an exercise, the cd was already applied and the event cwd is the answer.
  const cwd = typeof event.cwd === "string" && event.cwd ? event.cwd : PROJECT_ROOT;
  const fromCwd = exerciseFolderFor(cwd, PROJECT_ROOT);
  const ran = runDir(command, cwd, PROJECT_ROOT);
  const fromCommand = ran === cwd ? undefined : exerciseFolderFor(ran, PROJECT_ROOT);
  const folder = fromCommand ?? fromCwd;
  if (!folder) return; // npm start outside an exercise folder is not an exercise run

  if (input.run_in_background) {
    addContext(eventName, `run-evidence: the exercise run is in the background. When it finishes, read the newest log in ${join(folder, "Log")} and update RESULT.md.`);
    return;
  }

  const lines = [];
  if (eventName === "PostToolUseFailure") lines.push("run-evidence: the run exited with an error. Its log says why.");
  // npm start runs in the exercise folder, so a relative RUN_LOG_FILE resolves from there.
  const override = logOverride(command);
  const log = override ? logAt(resolve(folder, override)) : newestLog(folder);
  if (!log && override) lines.push(`run-evidence: RUN_LOG_FILE points at ${resolve(folder, override)}, which does not exist. The run wrote no log there.`);
  else if (!log) lines.push(`run-evidence: ${folder} has no Log/*.log. The run wrote no log; check that the entry point opens the run log.`);
  else {
    const window = typeof event.duration_ms === "number" ? event.duration_ms + SLACK_MS : FALLBACK_MS;
    if (Date.now() - log.mtimeMs > window) {
      lines.push(`run-evidence: WARNING the newest log was last written ${new Date(log.mtimeMs).toISOString()}, before this run started. This run may have written no log.`);
    }
    lines.push(...summariseLog(log.path, log.size));
  }
  lines.push("RESULT.md needs updating from this log: sections Run, Cost and What happened quote it (or use /run-exercise).");
  addContext(eventName, lines.join("\n"));
});
