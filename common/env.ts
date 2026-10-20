// env.ts — resolves ANTHROPIC_API_KEY and ANTHROPIC_MODEL: the repo-root .env file first, then the terminal environment

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

// The repo-root .env, one level above common/, whatever the cwd.
const ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));

const KEY_NAME = "ANTHROPIC_API_KEY";
// The value shipped in example.env: copying that file without editing it is not a key.
const PLACEHOLDER = "YourAnthropicApiKey";

function readEnvFile(name: string): string | undefined {
  if (!existsSync(ENV_FILE)) return undefined;
  return parseEnv(readFileSync(ENV_FILE, "utf8"))[name]?.trim() || undefined;
}

/** Puts the key in process.env, where the SDKs read it. Returns where it came from. */
export function loadAnthropicApiKey(): ".env" | "terminal" {
  const fromFile = readEnvFile(KEY_NAME);
  if (fromFile && fromFile !== PLACEHOLDER) {
    process.env[KEY_NAME] = fromFile; // .env wins over a key already set in the terminal
    return ".env";
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
  const fromFile = readEnvFile(MODEL_NAME);
  if (fromFile) {
    process.env[MODEL_NAME] = fromFile; // .env wins over the terminal
    return fromFile;
  }

  return process.env[MODEL_NAME]?.trim() || undefined;
}
