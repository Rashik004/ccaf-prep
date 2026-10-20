// run-log.mjs — pulls the summary line out of a run log written by common/log.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonical } from "./protected-paths.mjs";

/**
 * The JSON record that follows the last header matching `label`. common/log.ts writes
 * records as "===== label =====" and then pretty-printed JSON whose closing brace sits
 * alone at column 0.
 */
export function lastRecord(text, label) {
  const lines = text.split(/\r?\n/);
  let header = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("===== ") && label.test(lines[i])) {
      header = i;
      break;
    }
  }
  if (header === -1 || lines[header + 1] !== "{") return undefined;
  const end = lines.indexOf("}", header + 1);
  if (end === -1) return undefined;
  try {
    return JSON.parse(lines.slice(header + 1, end + 1).join("\n"));
  } catch {
    return undefined;
  }
}

const n = (v) => (typeof v === "number" ? v.toLocaleString("en-US") : "?");

/** Path, size, model, token totals, cost and duration of one run log, as text lines. */
export function summariseLog(path, size) {
  const text = readFileSync(path, "utf8");
  const lines = [`Run log: ${path} (${(size / 1024).toFixed(0)} KB)`];

  const title = /^▶ RUN {2}(.*)$/m.exec(text)?.[1];
  if (title) lines.push(`Run: ${title.length > 160 ? `${title.slice(0, 159)}…` : title}`);
  const model = /^ {7}model: (.*)$/m.exec(text)?.[1];
  if (model) lines.push(`Banner model: ${model}`);
  const outcome = [...text.matchAll(/^■ (.*)$/gm)].pop()?.[1];
  lines.push(`Outcome: ${outcome ?? "no closing ■ line (run still going, or killed)"}`);

  // Agent SDK runs end with a result message: the authoritative totals for the whole run.
  const result = lastRecord(text, /type=result\b/);
  if (result) {
    const secs = typeof result.duration_ms === "number" ? `${(result.duration_ms / 1000).toFixed(1)}s` : "?";
    const cost = typeof result.total_cost_usd === "number" ? `$${result.total_cost_usd.toFixed(4)}` : "?";
    lines.push(`Totals: ${secs}, ${n(result.num_turns)} turns, ${cost}`);
    for (const [name, u] of Object.entries(result.modelUsage ?? {})) {
      if (!u || typeof u !== "object") continue;
      const cost = typeof u.costUSD === "number" ? `$${u.costUSD.toFixed(4)}` : "?";
      lines.push(
        `  ${name}: input ${n(u.inputTokens)}, output ${n(u.outputTokens)}, ` +
          `cache read ${n(u.cacheReadInputTokens)}, cache write ${n(u.cacheCreationInputTokens)}, ${cost}`
      );
    }
  } else {
    lines.push("Totals: no result record in the log; read the per-call usage records for tokens and cost.");
  }
  return lines;
}

const ARG = String.raw`(?:"[^"]*"|'[^']*'|[^\s;&|()<>]+)`;
// npm flags that take a value; any other flag stands alone.
const VALUE_FLAG = String.raw`(?:--prefix|--workspace|-w|--loglevel)(?:=|\s+)${ARG}`;

/**
 * An npm start command at the start of a shell command: npm start, npm run start,
 * npm --prefix <dir> start, with flags and redirection. "start" must be the npm command
 * itself (npm install start-server does not count), and npm must be the command being
 * run (echo npm start, git commit -m "npm start" do not count).
 */
export const NPM_START = new RegExp(
  String.raw`(?:^|[;&|(\n])\s*npm(?:\.cmd)?(?:\s+(?:${VALUE_FLAG}|-[\w-]+))*\s+(?:run(?:-script)?\s+)?start(?=\s|$|[;&|<>)])`
);

const CD = new RegExp(
  String.raw`(?:^|[;&|(\n])\s*(?:cd|pushd|sl|Set-Location|Push-Location)(?:\s+-(?:Path|LiteralPath))?\s+(${ARG})`,
  "gi"
);

/**
 * Where the command ran npm start: its --prefix, else the cd chain before it, applied to
 * `cwd`. `root` replaces $CLAUDE_PROJECT_DIR in the command.
 */
export function runDir(command, cwd, root) {
  const unquote = (s) => s.replace(/^(["'])(.*)\1$/, "$2");
  const expand = (s) => s.replace(/\$(?:env:)?\{?CLAUDE_PROJECT_DIR\}?/g, root);
  const fix = (p) => {
    const plain = expand(unquote(p));
    return process.platform === "win32" ? canonical(plain) : plain;
  };
  const match = NPM_START.exec(command);
  if (!match) return cwd;
  let dir = cwd;
  for (const [, to] of command.slice(0, match.index + 1).matchAll(CD)) dir = resolve(dir, fix(to));
  const rest = command.slice(match.index);
  const prefix = new RegExp(String.raw`--prefix(?:=|\s+)(${ARG})`).exec(rest.split(/[;&|\n]/)[0]);
  return prefix ? resolve(dir, fix(prefix[1])) : dir;
}
