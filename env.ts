// env.ts — resolves ANTHROPIC_API_KEY: the repo-root .env file first, then the terminal environment

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const KEY_NAME = "ANTHROPIC_API_KEY";
// The value shipped in example.env: copying that file without editing it is not a key.
const PLACEHOLDER = "YourAnthropicApiKey";

/** Puts the key in process.env, where the Agent SDK reads it. Returns where it came from. */
export function loadAnthropicApiKey(): ".env" | "terminal" {
  const envPath = fileURLToPath(new URL(".env", import.meta.url)); // next to this file, whatever the cwd
  if (existsSync(envPath)) {
    const fromFile = parseEnv(readFileSync(envPath, "utf8"))[KEY_NAME]?.trim();
    if (fromFile && fromFile !== PLACEHOLDER) {
      process.env[KEY_NAME] = fromFile; // .env wins over a key already set in the terminal
      return ".env";
    }
  }

  if (process.env[KEY_NAME]) return "terminal";

  throw new Error(
    `${KEY_NAME} not found. Add it to .env (see example.env) or set it in the terminal.`
  );
}

const MODEL_NAME = "ANTHROPIC_MODEL";

/**
 * Reads the pinned model from .env (falling back to the terminal environment).
 * Returns undefined when nothing is set, which leaves the SDK on its own default.
 */
export function loadAnthropicModel(): string | undefined {
  const envPath = fileURLToPath(new URL(".env", import.meta.url));
  if (existsSync(envPath)) {
    const fromFile = parseEnv(readFileSync(envPath, "utf8"))[MODEL_NAME]?.trim();
    if (fromFile) {
      process.env[MODEL_NAME] = fromFile; // .env wins over the terminal
      return fromFile;
    }
  }

  return process.env[MODEL_NAME]?.trim() || undefined;
}
