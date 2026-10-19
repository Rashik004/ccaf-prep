// synthesis-prompt.ts — Step 4: the deterministic form of the context-passing contract
//
// The LLM coordinator is instructed to forward findings verbatim. This helper is
// the same contract in code: use it when orchestrating from code, or in tests to
// check what the coordinator should have passed on.

import type { ResearchResult } from "./types";

export function buildSynthesisPrompt(
  topic: string,
  webResults: ResearchResult,
  docResults: ResearchResult
): string {
  // Serialise WHOLE objects. No .map(f => f.claim), no picking fields:
  // anything left out here is lost to the synthesis agent for good.
  return `Synthesise the following research findings on: ${topic}
Every statement MUST include a citation copied from the findings.

Web search findings:
${JSON.stringify(webResults.findings, null, 2)}

Document analysis findings:
${JSON.stringify(docResults.findings, null, 2)}`;
}
