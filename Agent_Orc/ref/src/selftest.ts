// selftest.ts — offline checks for the parser and verifiers (no API key needed)
// Usage: npm test

import assert from "node:assert/strict";
import { parseResearchResult } from "./parse";
import { verifyAttribution, verifyParallelResearch } from "./verify";
import { buildSynthesisPrompt } from "./synthesis-prompt";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✔ ${name}`);
}

const web = parseResearchResult(
  '```json\n{"agent":"web-search","findings":[{"claim":"A","source_url":"https://a.example","document_name":"Page A","page_number":null,"confidence":"high","retrieved_by":"web-search"}]}\n```'
);
const doc = parseResearchResult(
  '{"agent":"doc-analysis","findings":[{"claim":"B","source_url":"file:///docs/r.md","document_name":"r.md","page_number":2,"confidence":"medium","retrieved_by":"doc-analysis"}]}'
);
const known = [...web.findings, ...doc.findings];

test("parser strips code fences and accepts valid findings", () => {
  assert.equal(web.findings.length, 1);
});

test("parser rejects a finding that omits page_number", () => {
  assert.throws(() =>
    parseResearchResult('{"agent":"web-search","findings":[{"claim":"x","source_url":"u","retrieved_by":"web-search"}]}')
  );
});

test("synthesis prompt carries every metadata field verbatim", () => {
  const prompt = buildSynthesisPrompt("t", web, doc);
  for (const field of ["source_url", "document_name", "page_number", "confidence", "retrieved_by"]) {
    assert.ok(prompt.includes(`"${field}"`), `missing ${field}`);
  }
});

test("fully attributed output passes", () => {
  const out = JSON.stringify({
    summary: "s",
    statements: [
      { text: "a", citations: [{ source_url: "https://a.example", document_name: "Page A", page_number: null }] },
      { text: "b", citations: [{ source_url: "file:///docs/r.md", document_name: "r.md", page_number: 2 }] },
    ],
  });
  assert.equal(verifyAttribution(out, known).issues.length, 0);
});

test("missing, invented and page-less citations are all flagged", () => {
  const out = JSON.stringify({
    summary: "s",
    statements: [
      { text: "none", citations: [] },
      { text: "fake", citations: [{ source_url: "https://fake.example", document_name: "F", page_number: null }] },
      { text: "nopage", citations: [{ source_url: "file:///docs/r.md", document_name: "r.md", page_number: null }] },
    ],
  });
  const problems = verifyAttribution(out, known).issues.map((i) => i.problem);
  assert.equal(problems.length, 3);
});

test("parallel spawn (one turn) passes", () => {
  verifyParallelResearch(new Map([["t1", ["web-search", "doc-analysis"]], ["t2", ["synthesis"]]]));
});

test("sequential spawn (two turns) fails", () => {
  assert.throws(
    () => verifyParallelResearch(new Map([["t1", ["web-search"]], ["t2", ["doc-analysis"]]])),
    /sequentially/
  );
});

console.log(`\n${passed} checks passed`);
