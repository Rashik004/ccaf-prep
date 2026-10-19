// agents.ts — Step 2 (research subagents) and Step 4 (synthesis subagent)
//
// Each AgentDefinition has: description (routing info for the coordinator),
// prompt (the subagent's system prompt) and a scoped tools list.
// The agent's NAME is its key in options.agents — see coordinator.ts.

import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { FINDING_SCHEMA, SYNTHESIS_OUTPUT_SCHEMA } from "./schema";

export const webSearchAgent: AgentDefinition = {
  description:
    "Searches the web for current information on a topic. " +
    "Use for recent facts, statistics and published sources. " +
    "Returns structured findings with source URLs and page titles.",
  prompt: `You are a web research specialist.

For the topic you are given:
1. Run targeted web searches and open the most relevant pages.
2. Extract specific, factual claims. Do not paraphrase loosely.
3. For EVERY claim, record the exact URL and the page title it came from.
4. If you cannot find a source for something, leave it out. Never invent a URL.

Return ONLY valid JSON matching this schema. No prose before or after it:
${FINDING_SCHEMA}
Set "agent" and every "retrieved_by" to "web-search".
Set document_name to the page title and page_number to null.`,
  // Scoped: web access only. No file access, no Agent (cannot spawn subagents).
  tools: ["WebSearch", "WebFetch"],
};

export const docAnalysisAgent: AgentDefinition = {
  description:
    "Analyses local documents (reports, papers, PDFs) relevant to a topic. " +
    "Use for evidence from provided files. " +
    "Returns structured findings with document names and page references.",
  prompt: `You are a document analysis specialist.

For the topic you are given:
1. Locate and read the relevant documents in the working directory.
2. Extract specific claims, figures and conclusions.
3. For EVERY claim, record the document name and the page number it appears on.
   For PDFs use the PDF page. For text files, use "--- Page N ---" markers if present.
4. If a page number cannot be determined, say so with null. Do not guess.
5. If no relevant documents exist, return {"agent": "doc-analysis", "findings": []}.

Return ONLY valid JSON matching this schema. No prose before or after it:
${FINDING_SCHEMA}
Set "agent" and every "retrieved_by" to "doc-analysis".
Set source_url to the file:// URI of the document, document_name to the file name,
and page_number to the page the claim appears on (null only if truly unknown).`,
  // Scoped: read-only file access. An analyst has no reason to modify evidence.
  tools: ["Read", "Grep", "Glob"],
};

export const synthesisAgent: AgentDefinition = {
  description:
    "Combines structured research findings into a single cited report. " +
    "Use only after web-search and doc-analysis have both returned their findings.",
  prompt: `You are a research synthesis specialist.

You will receive research findings as JSON. Each finding has a claim and its source metadata.

Rules:
1. Use ONLY the findings you are given. Do not add facts from your own knowledge.
2. Every statement you write MUST cite at least one finding, copying its source_url,
   document_name and page_number exactly as given.
3. If findings conflict, say so and cite both sides.
4. If a statement merges several findings, cite all of them.

Return ONLY valid JSON matching this schema:
${SYNTHESIS_OUTPUT_SCHEMA}`,
  // No tools: it can only work from what it is given, so it cannot
  // introduce new, unattributed material.
  tools: [],
};
