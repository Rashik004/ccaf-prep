// hook-io.mjs — stdin/stdout plumbing shared by the repo's Claude Code hooks

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Repo root, two levels above .claude/hooks/lib/, whatever the hook's cwd.
 * CCAF_HOOK_ROOT overrides it so the tests can run a hook against a scratch repo.
 */
export const PROJECT_ROOT = process.env.CCAF_HOOK_ROOT || fileURLToPath(new URL("../../../", import.meta.url));

/** Reads the JSON event Claude Code writes to the hook's stdin. Returns {} for empty input. */
export function readEvent() {
  const raw = readFileSync(0, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

/**
 * Prints the hook's JSON answer. Claude Code reads it only when the exit code is 0,
 * so this is the single exit path for a hook that has something to say.
 */
export function respond(output) {
  process.stdout.write(JSON.stringify(output));
}

/** Adds text to Claude's context. Valid for SessionStart, UserPromptSubmit, PostToolUse and PostToolUseFailure. */
export function addContext(hookEventName, text) {
  respond({ hookSpecificOutput: { hookEventName, additionalContext: text } });
}

/**
 * Runs a hook body and turns a crash into a stderr note plus exit 1.
 * Exit 1 is a non-blocking error: the session goes on and the user sees the message.
 */
export function runHook(name, body) {
  try {
    body();
  } catch (err) {
    process.stderr.write(`[${name}] hook failed: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }
}
