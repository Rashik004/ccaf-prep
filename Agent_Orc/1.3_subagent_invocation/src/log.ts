// log.ts — run trace for the coordinator/subagent pipeline.
//
// Two sinks:
//   stderr — the readable trace. stdout stays the report alone, so
//            `npm start -- "topic" > report.txt` still writes a clean report.
//            Set DEBUG_AGENTS=0 to silence it.
//   file   — ALWAYS written, never silenced, never truncated. Holds the
//            readable trace plus a full JSON dump of every stream message,
//            including the ones the coordinator does not act on (that is where
//            a SubagentHandback report arrives).
//
// Env:
//   DEBUG_AGENTS=0             silence the stderr trace (file still written)
//   DEBUG_AGENTS_PROMPT_MAX=n  truncate prompts on stderr (file keeps them whole)
//   DEBUG_RAW=1                also echo raw tool_result dumps to stderr
//   AGENT_LOG_FILE=path        write the log file here instead of logs/<ts>.log

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERBOSE = process.env.DEBUG_AGENTS !== "0";
const PROMPT_MAX = Number(process.env.DEBUG_AGENTS_PROMPT_MAX ?? 0) || undefined;

const RULE = "─".repeat(72);

// --- file sink -------------------------------------------------------------

function defaultLogPath(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  // logs/ sits next to src/, whatever the cwd
  const logsDir = fileURLToPath(new URL("../logs/", import.meta.url));
  return resolve(logsDir, `${stamp}_run.log`);
}

export const LOG_FILE = process.env.AGENT_LOG_FILE
  ? resolve(process.env.AGENT_LOG_FILE)
  : defaultLogPath();

let fileReady = false;
let fileBroken = false;

/** Appends synchronously: the process may exit(1) at any point and must not lose the tail. */
function toFile(text: string) {
  if (fileBroken) return;
  try {
    if (!fileReady) {
      mkdirSync(dirname(LOG_FILE), { recursive: true });
      fileReady = true;
    }
    appendFileSync(LOG_FILE, `${text}\n`, "utf8");
  } catch (err) {
    fileBroken = true; // never let logging kill the run
    console.error(`[log] file sink disabled (${(err as Error).message})`);
  }
}

function out(line: string) {
  if (VERBOSE) console.error(line);
  toFile(line);
}

/**
 * The short "what is happening right now" line. Unlike out(), DEBUG_AGENTS=0
 * does not silence it — it is the minimum needed to follow a run. Still stderr,
 * so `> report.txt` keeps giving a clean report.
 */
function headline(line: string) {
  console.error(line);
  toFile(line);
}

/** First sentence/line of a prompt, for the one-line headline. */
function gist(text: string, max = 100): string {
  const first = text.trim().split("\n").find((l) => l.trim()) ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

// --- formatting ------------------------------------------------------------

function quoteLines(text: string): string {
  return text.split("\n").map((l) => `   > ${l}`).join("\n");
}

/** Full text to the file, optionally truncated on stderr. */
function quoteBoth(text: string) {
  toFile(quoteLines(text));
  if (!VERBOSE) return;
  const shown =
    PROMPT_MAX && text.length > PROMPT_MAX
      ? `${text.slice(0, PROMPT_MAX)}\n…[${text.length - PROMPT_MAX} more chars; full text in ${LOG_FILE}]`
      : text;
  console.error(quoteLines(shown));
}

export interface ModelSource {
  model: string;
  source: "agent override" | "inherited from coordinator" | "SDK default";
}

/**
 * Which model a subagent actually runs on. An AgentDefinition.model wins;
 * otherwise the subagent inherits the coordinator's model.
 */
export function resolveModel(
  agentModel: string | undefined,
  coordinatorModel: string | undefined
): ModelSource {
  if (agentModel) return { model: agentModel, source: "agent override" };
  if (coordinatorModel) return { model: coordinatorModel, source: "inherited from coordinator" };
  return { model: "(unset)", source: "SDK default" };
}

// --- events ----------------------------------------------------------------

export function logBanner(topic: string, coordinatorModel: string | undefined) {
  headline(`\n${RULE}`);
  headline(`▶ RUN  ${topic}`);
  out(`       started: ${new Date().toISOString()}`);
  headline(`       model: ${coordinatorModel ?? "SDK default"}`);
  headline(`       log file: ${LOG_FILE}`);
  out(`       stderr trace: ${VERBOSE ? "on (DEBUG_AGENTS=0 to silence)" : "off"}`);
  headline(`${RULE}`);
}

export function logInit(info: { model?: string; tools?: string[]; agents?: string[] }) {
  out(`\n⚙ session init`);
  if (info.model) out(`   model  : ${info.model}`);
  if (info.tools?.length) out(`   tools  : ${info.tools.join(", ")}`);
  if (info.agents?.length) out(`   agents : ${info.agents.join(", ")}`);
}

export function logCoordinatorText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  out(`\n🧠 coordinator says:`);
  quoteBoth(trimmed);
}

export function logAgentCall(call: {
  name: string;
  model: ModelSource;
  prompt: string;
  description?: string;
  toolUseId: string;
  turnId: string;
  background?: boolean;
}) {
  headline(
    `\n→ calling ${call.name} (${call.model.model}) on: ` +
      `${call.description ?? gist(call.prompt)}`
  );
  out(`\n${RULE}`);
  out(`── Agent call ▶ ${call.name}   (turn ${call.turnId}, call ${call.toolUseId})`);
  out(`   model : ${call.model.model}  (${call.model.source})`);
  if (call.description) out(`   task  : ${call.description}`);
  out(`   background: ${call.background === true}`);
  out(`   prompt:`);
  quoteBoth(call.prompt || "(no prompt field in tool input)");
  out(RULE);
}

export function logAgentResult(res: {
  name: string;
  toolUseId: string;
  chars: number;
  ms?: number;
  isError?: boolean;
}) {
  const took = res.ms === undefined ? "" : ` in ${(res.ms / 1000).toFixed(1)}s`;
  const mark = res.isError ? "✗" : "←";
  headline(`${mark} ${res.name} returned ${res.chars} chars${took}`);
  out(`   (call ${res.toolUseId})`);
}

/** Headline companion to logAgentResult, once the payload has been parsed. */
export function logAgentFindings(agentName: string, count: number) {
  headline(`  ${agentName}: ${count} finding(s) parsed`);
}

/** One line per tick listing the subagent calls still in flight. */
export function logHeartbeat(inFlight: { name: string; ms: number }[]) {
  if (inFlight.length === 0) {
    headline(`   … coordinator thinking`);
    return;
  }
  headline(`   … running: ${inFlight.map((c) => `${c.name} (${Math.round(c.ms / 1000)}s)`).join(", ")}`);
}

export function logParseFailure(agentName: string, err: unknown, raw: string) {
  out(`\n✗ ${agentName}: could not parse findings — ${err instanceof Error ? err.message : err}`);
  out(`   raw payload was ${raw.length} chars; full text in ${LOG_FILE}`);
  toFile(`--- unparsed payload for ${agentName} (${raw.length} chars) ---`);
  toFile(raw);
  toFile(`--- end unparsed payload ---`);
}

/** Attribution issues, grouped by statement so one paragraph is printed once. */
export function logAttributionIssues(
  issues: { statementIndex: number; text: string; problem: string }[]
) {
  const byStatement = new Map<number, { text: string; problems: string[] }>();
  for (const issue of issues) {
    const entry = byStatement.get(issue.statementIndex) ?? { text: issue.text, problems: [] };
    entry.problems.push(issue.problem);
    byStatement.set(issue.statementIndex, entry);
  }

  out(`\n✗ Attribution check failed: ${issues.length} issue(s) across ${byStatement.size} statement(s)`);
  for (const [index, { text, problems }] of byStatement) {
    out(`\n  [${index}] ${problems.length} issue(s)`);
    quoteBoth(text);
    for (const problem of problems) out(`      - ${problem}`);
  }
}

/** Last thing written before the process exits non-zero. */
export function logRunError(err: unknown) {
  headline(`\n${RULE}`);
  headline(`■ RUN FAILED — ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) toFile(err.stack);
  headline(`${RULE}`);
}

/** The real payload came from a SubagentHandback, not from the tool_result stub. */
export function logHandback(agentName: string, toolUseId: string, chars: number, stubChars: number) {
  out(
    `
↩ ${agentName}: read ${chars} chars from its SubagentHandback report ` +
      `(tool_result was a ${stubChars}-char stub)  (call ${toolUseId})`
  );
}

export function logResultMessage(info: {
  subtype: string;
  durationMs?: number;
  numTurns?: number;
  costUsd?: number;
}) {
  const bits = [`subtype=${info.subtype}`];
  if (info.durationMs !== undefined) bits.push(`${(info.durationMs / 1000).toFixed(1)}s`);
  if (info.numTurns !== undefined) bits.push(`${info.numTurns} turns`);
  if (info.costUsd !== undefined) bits.push(`$${info.costUsd.toFixed(4)}`);
  headline(`\n${RULE}`);
  headline(`■ coordinator finished — ${bits.join(", ")}`);
  headline(`${RULE}`);
}

// --- raw dumps (file always; stderr only under DEBUG_RAW) ------------------

function safeJson(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "object" && v !== null) {
          if (seen.has(v as object)) return "[circular]";
          seen.add(v as object);
        }
        return v;
      },
      2
    );
  } catch (err) {
    return `[unserialisable: ${(err as Error).message}]`;
  }
}

/**
 * Every stream message, in full, to the file. This is the only place a
 * SubagentHandback report shows up: the Agent tool_result is just a pointer
 * stub, and the real payload arrives as its own message that the coordinator
 * loop would otherwise drop on the floor.
 */
export function logStreamMessage(seq: number, message: unknown) {
  const m = message as { type?: string; subtype?: string };
  toFile(`\n===== stream[${seq}] type=${m.type ?? "?"}${m.subtype ? ` subtype=${m.subtype}` : ""} =====`);
  toFile(safeJson(message));
}

/** Called for a message the coordinator loop does not act on — flagged on stderr too. */
export function logUnhandledMessage(seq: number, message: unknown) {
  const m = message as { type?: string; subtype?: string };
  const json = safeJson(message);
  out(
    `\n? stream[${seq}] unhandled: type=${m.type ?? "?"}` +
      `${m.subtype ? ` subtype=${m.subtype}` : ""} (${json.length} chars JSON — see log file)`
  );
}

export function logRawToolResult(agentName: string, block: unknown, joined: string) {
  const header =
    `\n=== RAW tool_result for ${agentName} ===\n` +
    `joined text (${joined.length} chars):\n${joined}\n` +
    `block JSON:\n${safeJson(block)}\n=== END ===`;
  toFile(header);
  if (process.env.DEBUG_RAW) console.error(header);
}
