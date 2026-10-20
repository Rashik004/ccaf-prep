// status.mjs — builds the curriculum-status text: progress counts, next todo tasks, API key check

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { PROJECT_ROOT } from "./hook-io.mjs";

export const ENV_FILE = join(PROJECT_ROOT, ".env");
const KEY_NAME = "ANTHROPIC_API_KEY";
// Same placeholder as example.env and common/env.ts: an unedited copy is not a key.
const PLACEHOLDER = "YourAnthropicApiKey";

const usable = (value) => Boolean(value?.trim()) && value.trim() !== PLACEHOLDER;

/**
 * Follows the lookup order of common/env.ts (.env first, then terminal).
 * Returns a warning when neither holds a usable key, else undefined. Never returns the key itself.
 */
export function keyWarning(envFile = ENV_FILE, terminalKey = process.env[KEY_NAME]) {
  const hasFile = existsSync(envFile);
  const fromFile = hasFile ? parseEnv(readFileSync(envFile, "utf8"))[KEY_NAME] : undefined;
  if (usable(fromFile) || usable(terminalKey)) return undefined;

  const reason = !hasFile
    ? ".env is missing"
    : fromFile?.trim() === PLACEHOLDER
      ? ".env still holds the placeholder key"
      : `.env has no ${KEY_NAME} value`;
  return `WARNING: ${reason} and the terminal has no ${KEY_NAME}. Exercise runs will fail before the first API call. Copy example.env to .env and set the key.`;
}

/** Progress counts, tasks in progress and the next three todo tasks. */
export function statusText(tasks) {
  if (!tasks.length) return "WARNING: docs/curriculum.md has no task rows this hook can parse. Check the table format.";
  const count = (status) => tasks.filter((t) => t.status === status).length;
  const label = (list) => list.map((t) => `${t.id} ${t.title}`).join("; ");
  const active = tasks.filter((t) => t.status === "in progress");
  const next = tasks.filter((t) => t.status === "todo").slice(0, 3);

  const lines = [
    `Curriculum (docs/curriculum.md): ${count("done")} done, ${count("in progress")} in progress, ${count("todo")} todo, ${tasks.length} total.`,
  ];
  if (active.length) lines.push(`In progress: ${label(active)}.`);
  lines.push(next.length ? `Next todo: ${label(next)}.` : "No todo tasks left.");
  return lines.join("\n");
}
