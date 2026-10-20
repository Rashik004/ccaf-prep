// report.ts — saves the verified synthesis report to disk.
//
// Env:
//   AGENT_REPORT_FILE=path   write the report here instead of output/<ts>_report.md

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileStamp } from "../../../common/stamp";
import type { Finding, SynthesisOutput } from "./types";

function defaultReportPath(): string {
  // output/ sits next to src/, whatever the cwd
  const outputDir = fileURLToPath(new URL("../output/", import.meta.url));
  return resolve(outputDir, `${fileStamp()}_report.md`);
}

export const REPORT_FILE = process.env.AGENT_REPORT_FILE
  ? resolve(process.env.AGENT_REPORT_FILE)
  : defaultReportPath();

function formatCitation(c: { source_url: string; document_name: string; page_number: number | null }): string {
  return c.page_number !== null ? `${c.document_name}, p.${c.page_number}` : c.source_url;
}

function toMarkdown(topic: string, report: SynthesisOutput, findings: Finding[]): string {
  const lines: string[] = [];
  lines.push(`# Research report: ${topic}`);
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()} — ${findings.length} finding(s), all statements verified._`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(report.summary);
  lines.push("");
  lines.push("## Statements");
  lines.push("");
  report.statements.forEach((s, i) => {
    const refs = s.citations.map(formatCitation).join("; ");
    lines.push(`${i + 1}. ${s.text}`);
    lines.push(`   [${refs}]`);
    lines.push("");
  });
  return lines.join("\n");
}

/** Writes the verified report to REPORT_FILE and returns the path written. */
export function saveReport(topic: string, report: SynthesisOutput, findings: Finding[]): string {
  mkdirSync(dirname(REPORT_FILE), { recursive: true });
  writeFileSync(REPORT_FILE, toMarkdown(topic, report, findings), "utf8");
  return REPORT_FILE;
}
