// types.ts — Step 3 (findings) and Step 5 (synthesis output)

/** Which research subagent produced a finding: a closed set, not free text. */
export type RetrievedBy = "web-search" | "doc-analysis";

/** A single finding. Content (`claim`) is kept separate from attribution metadata. */
export interface Finding {
  // --- Content ---
  claim: string;

  // --- Metadata (attribution) ---
  /** Web: https://...  |  Document: file:///path/to/report.pdf */
  source_url: string;
  /** Web: page title  |  Document: file name */
  document_name: string;
  /** Web: null  |  Document: page the claim appears on (null only if truly unknown) */
  page_number: number | null;
  confidence: "high" | "medium" | "low";
  retrieved_by: RetrievedBy;
}

/** What each research subagent returns. */
export interface ResearchResult {
  agent: RetrievedBy;
  findings: Finding[];
}

/** A citation as copied by the synthesis agent from a Finding. */
export interface Citation {
  source_url: string;
  document_name: string;
  page_number: number | null;
}

export interface SynthesisStatement {
  text: string;
  citations: Citation[];
}

export interface SynthesisOutput {
  summary: string;
  statements: SynthesisStatement[];
}

export interface AttributionIssue {
  statementIndex: number;
  text: string;
  problem: string;
}
