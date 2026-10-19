// index.ts — entry point
// Usage: npm start -- "your research topic"

import { runCoordinator } from "./coordinator";
import { loadAnthropicApiKey } from "../../../env";

async function main() {
  console.log(`Using ANTHROPIC_API_KEY from ${loadAnthropicApiKey()}`);

  const topic = process.argv.slice(2).join(" ") || "The impact of heat pumps on household energy bills";
  const { report, findings } = await runCoordinator(topic);

  console.log(`\nCollected ${findings.length} findings. All statements verified.\n`);
  console.log(report.summary, "\n");
  report.statements.forEach((s, i) => {
    const refs = s.citations
      .map((c) => (c.page_number !== null ? `${c.document_name}, p.${c.page_number}` : c.source_url))
      .join("; ");
    console.log(`${i + 1}. ${s.text}\n   [${refs}]`);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
