// protect-generated-paths.mjs — PreToolUse hook on file-writing tools: denies writes to an
// exercise's Log/ and output/, node_modules/, .env files and package-lock.json. A deny is a
// blocking decision: the tool call does not run and Claude gets the reason back.

import { PROJECT_ROOT, readEvent, respond, runHook } from "./lib/hook-io.mjs";
import { protectionReason } from "./lib/protected-paths.mjs";

runHook("protect-generated-paths", () => {
  const event = readEvent();
  const input = event.tool_input ?? {};
  const target = input.file_path ?? input.notebook_path;
  if (typeof target !== "string" || !target) return;

  const cwd = typeof event.cwd === "string" && event.cwd ? event.cwd : PROJECT_ROOT;
  const reason = protectionReason(target, PROJECT_ROOT, cwd);
  if (!reason) return;
  respond({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `protect-generated-paths: ${reason}`,
    },
  });
});
