// schema.ts — the output contracts written into the subagent prompts

export const FINDING_SCHEMA = `{
  "agent": "web-search" | "doc-analysis",
  "findings": [
    {
      "claim": string,
      "source_url": string,
      "document_name": string,
      "page_number": number | null,
      "confidence": "high" | "medium" | "low",
      "retrieved_by": "web-search" | "doc-analysis"
    }
  ]
}`;

export const SYNTHESIS_OUTPUT_SCHEMA = `{
  "summary": string,
  "statements": [
    {
      "text": string,
      "citations": [
        { "source_url": string, "document_name": string, "page_number": number | null }
      ]
    }
  ]
}`;
