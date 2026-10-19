// parse.ts — Step 3: enforce the finding contract at the agent boundary

import type { ResearchResult } from "./types";

/** Models sometimes wrap JSON in ```json fences or add a sentence before it. */
export function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in output");
  }
  return raw.slice(start, end + 1);
}

export function parseResearchResult(raw: string): ResearchResult {
  const parsed = JSON.parse(extractJson(raw)) as ResearchResult;

  if (!Array.isArray(parsed.findings)) {
    throw new Error(`${parsed.agent ?? "unknown agent"}: missing findings array`);
  }
  for (const [i, f] of parsed.findings.entries()) {
    if (!f.claim || !f.source_url || !f.retrieved_by) {
      throw new Error(
        `${parsed.agent}: finding ${i} is missing claim, source_url or retrieved_by`
      );
    }
    if (f.page_number === undefined) {
      throw new Error(
        `${parsed.agent}: finding ${i} omits page_number (use null if not applicable)`
      );
    }
  }
  return parsed;
}
