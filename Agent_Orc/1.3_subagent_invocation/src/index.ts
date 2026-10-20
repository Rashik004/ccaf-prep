// index.ts — entry point
// Usage: npm start -- "your research topic"

import { runCoordinator } from "./coordinator";
import { loadAnthropicApiKey, loadAnthropicModel } from "../../../common/env";
import { LOG_FILE, logBanner, logRunError } from "./log";
import { saveReport } from "./report";

async function main() {
  console.log(`Using ANTHROPIC_API_KEY from ${loadAnthropicApiKey()}`);
  console.log(`Model: ${loadAnthropicModel() ?? "SDK default (ANTHROPIC_MODEL not set)"}`);

  const topic = process.argv.slice(2).join(" ") || "The impact of heat pumps on household energy bills";
  logBanner(topic, loadAnthropicModel());
  const { report, findings } = await runCoordinator(topic);

  console.log(`\nCollected ${findings.length} findings. All statements verified.\n`);
  console.log(report.summary, "\n");
  report.statements.forEach((s, i) => {
    const refs = s.citations
      .map((c) => (c.page_number !== null ? `${c.document_name}, p.${c.page_number}` : c.source_url))
      .join("; ");
    console.log(`${i + 1}. ${s.text}\n   [${refs}]`);
  });

  const reportPath = saveReport(topic, report, findings);
  console.error(`\nReport saved to: ${reportPath}`);
  console.error(`Full run log: ${LOG_FILE}`);
}

main().catch((err) => {
  logRunError(err);
  console.error(err instanceof Error ? err.message : err);
  console.error(`\nFull run log: ${LOG_FILE}`);
  process.exit(1);
});
