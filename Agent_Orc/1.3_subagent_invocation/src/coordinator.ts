// coordinator.ts — Steps 1, 4, 5 and 6 brought together
//
// There is no Agent class: the coordinator is a query() call whose options carry
// its system prompt, its tools ("Agent" — "Task" in the exam guide) and the
// subagent definitions keyed by name.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { webSearchAgent, docAnalysisAgent, synthesisAgent } from "./agents";
import { parseResearchResult } from "./parse";
import { verifyAttribution, verifyParallelResearch } from "./verify";
import { loadAnthropicModel } from "../../../env";
import {
  logAgentCall,
  logAgentResult,
  logAgentFindings,
  logHandback,
  logAttributionIssues,
  logCoordinatorText,
  logHeartbeat,
  logInit,
  logParseFailure,
  logRawToolResult,
  logResultMessage,
  logStreamMessage,
  logUnhandledMessage,
  resolveModel,
} from "./log";
import type { Finding, SynthesisOutput } from "./types";

const COORDINATOR_PROMPT = `You are a research coordinator.
You do NOT research topics yourself and must never answer from your own knowledge.

Workflow:
1. PARALLEL RESEARCH: in a SINGLE response, emit TWO Agent tool calls together:
   - one to "web-search"
   - one to "doc-analysis"
   These tasks are independent: both calls go in the same response so they run
   side by side. Every Agent call MUST pass "run_in_background": false, so the
   call returns the subagent's own JSON output instead of a launch receipt.
   Never spawn a background agent and never use SendMessage.
   Each research prompt states ONLY the topic and scope: what to look for,
   where to look, and what to leave out. Do NOT describe an output format, JSON
   shape, field list or example values. Each subagent already has its own
   output schema, and a schema in your prompt overrides it (for example, a
   literal "source_url": null makes every finding fail validation).
2. SYNTHESIS: once BOTH have returned, invoke the "synthesis" subagent. Its prompt
   MUST contain the COMPLETE JSON from both research subagents, copied verbatim.
   - Do NOT summarise, shorten, reformat or drop any finding.
   - Do NOT remove any field (source_url, document_name, page_number,
     confidence, retrieved_by).
3. Return the synthesis subagent's JSON as your final answer, with nothing else.`;

const RESEARCH_AGENTS = new Set(["web-search", "doc-analysis"]);

const HEARTBEAT_MS = 5000;

export interface CoordinatorResult {
  report: SynthesisOutput;
  findings: Finding[];
}

export async function runCoordinator(topic: string): Promise<CoordinatorResult> {
  const coordinatorModel = loadAnthropicModel();

  const agents = {
    "web-search": webSearchAgent,
    "doc-analysis": docAnalysisAgent,
    "synthesis": synthesisAgent,
  };

  const result = query({
    prompt: `Research the following topic and produce a cited report: ${topic}`,
    options: {
      systemPrompt: COORDINATOR_PROMPT,
      // Pinned via ANTHROPIC_MODEL in .env. Subagents inherit this model unless
      // their own AgentDefinition overrides it.
      model: coordinatorModel,
      // Subagents default to running in the background: the Agent tool_result is
      // then only a launch receipt and the real output arrives as an out-of-band
      // task notification. This pipeline reads findings off the tool_result, so
      // background tasks are disabled for the session.
      env: { ...process.env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" },
      // Step 1: the coordinator's only tool is the one that spawns subagents.
      allowedTools: ["Agent"],
      // Step 2/4: the key is the agent's name.
      agents,
    },
  });

  const agentCalls = new Map<string, string>(); // tool_use_id -> subagent name
  const callsByTurn = new Map<string, string[]>(); // assistant message id -> subagent names
  const inFlight = new Map<string, { name: string; startedAt: number }>(); // tool_use_id -> start
  const knownFindings: Finding[] = [];
  let finalResult: string | undefined;

  // The stream yields nothing while a subagent works, so without this the run
  // looks hung for minutes at a time.
  const heartbeat = setInterval(() => {
    const now = Date.now();
    logHeartbeat(
      [...inFlight.values()].map((c) => ({ name: c.name, ms: now - c.startedAt }))
    );
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  let seq = 0;

  try {
    for await (const message of result) {
      // Every message, in full, to the log file. A SubagentHandback report
      // arrives as its own message — the Agent tool_result is only a pointer
      // stub — so nothing in the stream may go unrecorded.
      seq += 1;
      logStreamMessage(seq, message);
      let handled = false;

      if (message.type === "system" && message.subtype === "init") {
        handled = true;
        const init = message as unknown as {
          model?: string;
          tools?: string[];
          agents?: string[];
        };
        logInit({
          model: init.model ?? coordinatorModel,
          tools: init.tools,
          agents: init.agents ?? Object.keys(agents),
        });
      }

      // Coordinator turns: record every Agent call and the turn it was made in.
      if (message.type === "assistant") {
        const turnId = message.message.id; // blocks from one model turn share this id
        for (const block of message.message.content) {
          if (block.type === "text") {
            handled = true;
            logCoordinatorText(block.text);
            continue;
          }
          if (block.type === "tool_use" && (block.name === "Agent" || block.name === "Task")) {
            const input = block.input as {
              subagent_type?: string;
              prompt?: string;
              description?: string;
              model?: string;
              run_in_background?: boolean;
            };
            handled = true;
            const name = input.subagent_type ?? "unknown";
            agentCalls.set(block.id, name);
            callsByTurn.set(turnId, [...(callsByTurn.get(turnId) ?? []), name]);
            inFlight.set(block.id, { name, startedAt: Date.now() });

            const definition = (agents as Record<string, { model?: string }>)[name];
            logAgentCall({
              name,
              model: resolveModel(input.model ?? definition?.model, coordinatorModel),
              prompt: input.prompt ?? "",
              description: input.description,
              toolUseId: block.id,
              turnId,
              background: input.run_in_background,
            });
          }
        }
      }

      // Tool results arrive as user messages: capture the research findings.
      if (message.type === "user" && Array.isArray(message.message.content)) {
        // A subagent hands its report back out of band (its SubagentHandback
        // call). The tool_result content is then only a pointer stub — the
        // payload rides alongside it on the message itself.
        const handback = (message as { tool_use_result?: { handbackReport?: { text?: string } } })
          .tool_use_result?.handbackReport?.text;
        const toolResultCount = message.message.content.filter(
          (b) => b.type === "tool_result"
        ).length;

        for (const block of message.message.content) {
          if (block.type !== "tool_result") continue;
          const agentName = agentCalls.get(block.tool_use_id);
          if (!agentName) continue;
          handled = true;

          const stub =
            typeof block.content === "string"
              ? block.content
              : (block.content ?? [])
                  .map((c) => (c.type === "text" ? c.text : ""))
                  .join("");

          // The handback belongs to this block only when the message carries a
          // single tool_result; otherwise fall back to the block's own content.
          const text = handback && toolResultCount === 1 ? handback : stub;
          if (text !== stub) logHandback(agentName, block.tool_use_id, text.length, stub.length);

          const started = inFlight.get(block.tool_use_id);
          inFlight.delete(block.tool_use_id);
          logAgentResult({
            name: agentName,
            toolUseId: block.tool_use_id,
            chars: text.length,
            ms: started ? Date.now() - started.startedAt : undefined,
            isError: (block as { is_error?: boolean }).is_error,
          });

          logRawToolResult(agentName, block, text);

          if (!RESEARCH_AGENTS.has(agentName)) continue;

          // A background Agent call returns a launch receipt, not the findings.
          // Fail loudly: silently warning here would let the run continue with
          // zero known findings and blame the synthesis agent instead.
          if (/^Async agent launched successfully/.test(text)) {
            throw new Error(
              `${agentName} was spawned as a background agent, so its tool_result is a ` +
                `launch receipt rather than its JSON findings. The coordinator must pass ` +
                `"run_in_background": false on every Agent call.`
            );
          }
          // Fail fast. Warning here would let the run buy a full synthesis call
          // whose every citation the attribution check is already guaranteed to
          // reject, and blame the synthesis agent for an upstream parse failure.
          let findings: Finding[];
          try {
            findings = parseResearchResult(text).findings;
          } catch (err) {
            logParseFailure(agentName, err, text);
            throw new Error(
              `${agentName} returned findings that could not be parsed: ` +
                `${err instanceof Error ? err.message : err}. ` +
                `The ${text.length}-char payload is in the run log.`
            );
          }
          knownFindings.push(...findings);
          logAgentFindings(agentName, findings.length);
        }
      }

      if (message.type === "result") {
        handled = true;
        const info = message as unknown as {
          duration_ms?: number;
          num_turns?: number;
          total_cost_usd?: number;
        };
        logResultMessage({
          subtype: message.subtype,
          durationMs: info.duration_ms,
          numTurns: info.num_turns,
          costUsd: info.total_cost_usd,
        });
        if (message.subtype === "success") finalResult = message.result;
        else throw new Error(`Coordinator ended with ${message.subtype}`);
      }

      // Anything the loop did not act on. The handback report lands here.
      if (!handled) logUnhandledMessage(seq, message);
    }
  } finally {
    clearInterval(heartbeat);
  }

  if (!finalResult) throw new Error("Coordinator finished without a successful result");

  // Step 6: prove the research subagents were spawned in parallel.
  verifyParallelResearch(callsByTurn);

  // Step 5: prove every statement is attributed to a real source.
  const { output, issues } = verifyAttribution(finalResult, knownFindings);
  if (issues.length > 0) {
    logAttributionIssues(issues);
    throw new Error(`${issues.length} attribution issue(s) found`);
  }

  return { report: output, findings: knownFindings };
}
