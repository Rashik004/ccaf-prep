// verify.ts — Step 5 (attribution) and Step 6 (parallelism)

import type { AttributionIssue, Finding, SynthesisOutput } from "./types";
import { extractJson } from "./parse";

/**
 * Step 5: every statement must be
 *   1. present — at least one citation with a source_url
 *   2. real    — cites a source_url the research agents actually returned
 *   3. precise — document (file://) citations carry a page_number
 */
export function verifyAttribution(
  rawOutput: string,
  knownFindings: Finding[]
): { output: SynthesisOutput; issues: AttributionIssue[] } {
  const output = JSON.parse(extractJson(rawOutput)) as SynthesisOutput;
  const issues: AttributionIssue[] = [];
  const knownUrls = new Set(knownFindings.map((f) => f.source_url));

  if (!Array.isArray(output.statements) || output.statements.length === 0) {
    issues.push({ statementIndex: -1, text: "", problem: "Synthesis output has no statements" });
    return { output, issues };
  }

  output.statements.forEach((s, i) => {
    const flag = (problem: string) => issues.push({ statementIndex: i, text: s.text, problem });

    // Check 1: present
    const cited = (s.citations ?? []).filter((c) => c.source_url?.trim());
    if (cited.length === 0) {
      flag("No citation with a source_url");
      return;
    }

    for (const c of cited) {
      // Check 2: real
      if (!knownUrls.has(c.source_url)) {
        flag(`Cites unknown source: ${c.source_url}`);
      }
      // Check 3: precise
      if (c.source_url.startsWith("file://") && c.page_number === null) {
        flag(`Document citation without page number: ${c.document_name}`);
      }
    }
  });

  return { output, issues };
}

/**
 * Step 6: both research subagents must be invoked in the SAME model turn.
 * `callsByTurn` maps an assistant message id to the subagents it invoked.
 */
export function verifyParallelResearch(callsByTurn: Map<string, string[]>): void {
  const parallelTurn = [...callsByTurn.values()].find(
    (names) => names.includes("web-search") && names.includes("doc-analysis")
  );

  if (!parallelTurn) {
    const sequence = [...callsByTurn.values()].map((n) => `[${n.join(", ")}]`).join(" -> ");
    throw new Error(`Research subagents ran sequentially: ${sequence || "(no Agent calls)"}`);
  }
}
