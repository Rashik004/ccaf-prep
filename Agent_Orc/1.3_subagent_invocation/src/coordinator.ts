// coordinator.ts — Steps 1, 4, 5 and 6 brought together
//
// There is no Agent class: the coordinator is a query() call whose options carry
// its system prompt, its tools ("Agent" — "Task" in the exam guide) and the
// subagent definitions keyed by name.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { webSearchAgent, docAnalysisAgent, synthesisAgent } from "./agents";
import { parseResearchResult } from "./parse";
import { verifyAttribution, verifyParallelResearch } from "./verify";
import type { Finding, SynthesisOutput } from "./types";

const COORDINATOR_PROMPT = `You are a research coordinator.
You do NOT research topics yourself and must never answer from your own knowledge.

Workflow:
1. PARALLEL RESEARCH: in a SINGLE response, emit TWO Agent tool calls together:
   - one to "web-search"
   - one to "doc-analysis"
   These tasks are independent. Do NOT wait for one before starting the other.
2. SYNTHESIS: once BOTH have returned, invoke the "synthesis" subagent. Its prompt
   MUST contain the COMPLETE JSON from both research subagents, copied verbatim.
   - Do NOT summarise, shorten, reformat or drop any finding.
   - Do NOT remove any field (source_url, document_name, page_number,
     confidence, retrieved_by).
3. Return the synthesis subagent's JSON as your final answer, with nothing else.`;

const RESEARCH_AGENTS = new Set(["web-search", "doc-analysis"]);

export interface CoordinatorResult {
  report: SynthesisOutput;
  findings: Finding[];
}

export async function runCoordinator(topic: string): Promise<CoordinatorResult> {
  const result = query({
    prompt: `Research the following topic and produce a cited report: ${topic}`,
    options: {
      systemPrompt: COORDINATOR_PROMPT,
      // Step 1: the coordinator's only tool is the one that spawns subagents.
      allowedTools: ["Agent"],
      // Step 2/4: the key is the agent's name.
      agents: {
        "web-search": webSearchAgent,
        "doc-analysis": docAnalysisAgent,
        "synthesis": synthesisAgent,
      },
    },
  });

  const agentCalls = new Map<string, string>(); // tool_use_id -> subagent name
  const callsByTurn = new Map<string, string[]>(); // assistant message id -> subagent names
  const knownFindings: Finding[] = [];
  let finalResult: string | undefined;

  for await (const message of result) {
    // Coordinator turns: record every Agent call and the turn it was made in.
    if (message.type === "assistant") {
      const turnId = message.message.id; // blocks from one model turn share this id
      for (const block of message.message.content) {
        if (block.type === "tool_use" && (block.name === "Agent" || block.name === "Task")) {
          const name = (block.input as { subagent_type?: string }).subagent_type ?? "unknown";
          agentCalls.set(block.id, name);
          callsByTurn.set(turnId, [...(callsByTurn.get(turnId) ?? []), name]);
        }
      }
    }

    // Tool results arrive as user messages: capture the research findings.
    if (message.type === "user" && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (block.type !== "tool_result") continue;
        const agentName = agentCalls.get(block.tool_use_id);
        if (!agentName || !RESEARCH_AGENTS.has(agentName)) continue;

        const text =
          typeof block.content === "string"
            ? block.content
            : (block.content ?? [])
                .map((c) => (c.type === "text" ? c.text : ""))
                .join("");
        try {
          knownFindings.push(...parseResearchResult(text).findings);
        } catch (err) {
          console.warn(`Could not parse ${agentName} output:`, err);
        }
      }
    }

    if (message.type === "result") {
      if (message.subtype === "success") finalResult = message.result;
      else throw new Error(`Coordinator ended with ${message.subtype}`);
    }
  }

  if (!finalResult) throw new Error("Coordinator finished without a successful result");

  // Step 6: prove the research subagents were spawned in parallel.
  verifyParallelResearch(callsByTurn);

  // Step 5: prove every statement is attributed to a real source.
  const { output, issues } = verifyAttribution(finalResult, knownFindings);
  if (issues.length > 0) {
    console.error("Attribution check failed:");
    for (const issue of issues) {
      console.error(`  [${issue.statementIndex}] ${issue.problem}\n      "${issue.text}"`);
    }
    throw new Error(`${issues.length} attribution issue(s) found`);
  }

  return { report: output, findings: knownFindings };
}
