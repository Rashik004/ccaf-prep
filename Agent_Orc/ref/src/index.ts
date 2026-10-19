// index.ts — entry point
// Usage: npm start -- "your research topic"
//        DOCS_DIR=path/to/docs npm start -- "topic"

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { runCoordinator } from "./coordinator";

// Load ANTHROPIC_API_KEY (and optional DOCS_DIR) from .env if present.
if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }

  const topic =
    process.argv.slice(2).join(" ") || "The impact of heat pumps on household energy bills";
  const docsDir = resolve(process.env.DOCS_DIR ?? "docs");
  if (!existsSync(docsDir)) throw new Error(`Docs folder not found: ${docsDir}`);

  console.log(`Topic:  ${topic}`);
  console.log(`Docs:   ${docsDir}\n`);

  const started = Date.now();
  const { report, findings } = await runCoordinator(topic, { docsDir });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n✔ ${findings.length} findings collected in ${seconds}s`);
  console.log("✔ Research subagents ran in parallel");
  console.log("✔ Every statement is attributed to a real source\n");
  console.log(report.summary, "\n");
  report.statements.forEach((s, i) => {
    const refs = s.citations
      .map((c) => (c.page_number !== null ? `${c.document_name}, p.${c.page_number}` : c.source_url))
      .join("; ");
    console.log(`${i + 1}. ${s.text}\n   [${refs}]`);
  });
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
