// log.ts — this lesson's trace events, on top of the shared run log in common/.
//
// The shared log owns the file in Log/, the stderr trace and the full JSON
// record of every stream message. This file names the moments the lesson is
// about: an Agent call and the prompt it carried, the handback, the findings
// parsed from it, the attribution verdict.

import { gist, openRunLog, RULE, safeJson } from "../../../common/log";

// Log/ sits in the exercise folder, next to src/, whatever the cwd.
export const log = openRunLog(new URL("../", import.meta.url));
export const LOG_FILE = log.file;

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
  log.banner(topic, {
    started: new Date().toISOString(),
    model: coordinatorModel ?? "SDK default",
  });
}

export function logInit(info: { model?: string; tools?: string[]; agents?: string[] }) {
  log.out(`\n⚙ session init`);
  if (info.model) log.out(`   model  : ${info.model}`);
  if (info.tools?.length) log.out(`   tools  : ${info.tools.join(", ")}`);
  if (info.agents?.length) log.out(`   agents : ${info.agents.join(", ")}`);
}

export function logCoordinatorText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  log.out(`\n🧠 coordinator says:`);
  log.quote(trimmed);
}

/** The prompt is the whole context the subagent gets, so it is logged in full. */
export function logAgentCall(call: {
  name: string;
  model: ModelSource;
  prompt: string;
  description?: string;
  toolUseId: string;
  turnId: string;
  background?: boolean;
}) {
  log.headline(
    `\n→ calling ${call.name} (${call.model.model}) on: ` +
      `${call.description ?? gist(call.prompt)}`
  );
  log.out(`\n${RULE}`);
  log.out(`── Agent call ▶ ${call.name}   (turn ${call.turnId}, call ${call.toolUseId})`);
  log.out(`   model : ${call.model.model}  (${call.model.source})`);
  if (call.description) log.out(`   task  : ${call.description}`);
  log.out(`   background: ${call.background === true}`);
  log.out(`   prompt:`);
  log.quote(call.prompt || "(no prompt field in tool input)");
  log.out(RULE);
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
  log.headline(`${mark} ${res.name} returned ${res.chars} chars${took}`);
  log.out(`   (call ${res.toolUseId})`);
}

/** Headline companion to logAgentResult, once the payload has been parsed. */
export function logAgentFindings(agentName: string, count: number) {
  log.headline(`  ${agentName}: ${count} finding(s) parsed`);
}

/** One line per tick listing the subagent calls still in flight. */
export function logHeartbeat(inFlight: { name: string; ms: number }[]) {
  if (inFlight.length === 0) {
    log.headline(`   … coordinator thinking`);
    return;
  }
  log.headline(`   … running: ${inFlight.map((c) => `${c.name} (${Math.round(c.ms / 1000)}s)`).join(", ")}`);
}

export function logParseFailure(agentName: string, err: unknown, raw: string) {
  log.out(`\n✗ ${agentName}: could not parse findings — ${err instanceof Error ? err.message : err}`);
  log.out(`   raw payload was ${raw.length} chars; full text in ${LOG_FILE}`);
  log.dump(`unparsed payload for ${agentName} (${raw.length} chars)`, raw);
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

  log.out(`\n✗ Attribution check failed: ${issues.length} issue(s) across ${byStatement.size} statement(s)`);
  for (const [index, { text, problems }] of byStatement) {
    log.out(`\n  [${index}] ${problems.length} issue(s)`);
    log.quote(text);
    for (const problem of problems) log.out(`      - ${problem}`);
  }
}

/** Last thing written before the process exits non-zero. */
export function logRunError(err: unknown) {
  log.runError(err);
}

/** The real payload came from a SubagentHandback, not from the tool_result stub. */
export function logHandback(agentName: string, toolUseId: string, chars: number, stubChars: number) {
  log.out(
    `\n↩ ${agentName}: read ${chars} chars from its SubagentHandback report ` +
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
  log.finished(`coordinator finished — ${bits.join(", ")}`);
}

// --- raw dumps (file always; stderr only under DEBUG_RAW) ------------------

/**
 * Every stream message, in full, to the file. This is the only place a
 * SubagentHandback report shows up: the Agent tool_result is just a pointer
 * stub, and the real payload arrives as its own message that the coordinator
 * loop would otherwise drop on the floor.
 */
export function logStreamMessage(seq: number, message: unknown) {
  log.stream(seq, message);
}

/** Called for a message the coordinator loop does not act on — flagged on stderr too. */
export function logUnhandledMessage(seq: number, message: unknown) {
  const m = message as { type?: string; subtype?: string };
  const json = safeJson(message);
  log.out(
    `\n? stream[${seq}] unhandled: type=${m.type ?? "?"}` +
      `${m.subtype ? ` subtype=${m.subtype}` : ""} (${json.length} chars JSON — see log file)`
  );
}

export function logRawToolResult(agentName: string, block: unknown, joined: string) {
  log.dump(
    `RAW tool_result for ${agentName}`,
    `joined text (${joined.length} chars):\n${joined}\nblock JSON:\n${safeJson(block)}`
  );
}
