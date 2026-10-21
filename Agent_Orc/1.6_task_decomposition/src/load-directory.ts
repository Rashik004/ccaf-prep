// load-directory.ts — Step 1: read the directory under review, in a fixed order.
//
// Attention dilution is about position: in one long context, the files near the end get
// less attention than the files near the start. So the order is fixed (sorted by name),
// every file keeps its 1-based position, and both approaches see the files in that order.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFailed, log, logCheck, logFileRead, logPassStart } from "./log";
import type { SourceFile } from "./types";

/**
 * Matches one line of rendered raw source, as numbered() below writes it ("  12│ code").
 * The integration check uses it to prove no source got into stage 2. Change both together.
 */
export const NUMBERED_LINE: RegExp = /^\s*\d+│ /m;

/** Fewer files than this and there is little to dilute: the comparison would show no difference. */
const MIN_FILES = 10;

function isSource(name: string): boolean {
  return (name.endsWith(".ts") || name.endsWith(".js")) && !name.endsWith(".d.ts");
}

/** The file's lines, without the empty "line" after a trailing newline. */
function sourceLines(text: string): string[] {
  return text.replace(/\n$/, "").split("\n");
}

export function loadDirectory(dir: string): SourceFile[] {
  logPassStart(`Step 1: load directory ${dir}`);
  // Plain name sort: the zero-padded prefixes (01_ ... 10_) make it the intended order.
  const names = readdirSync(dir).filter(isSource).sort();
  const files = names.map((name, i): SourceFile => {
    const path = join(dir, name);
    const text = readFileSync(path, "utf8");
    return { position: i + 1, name, path, lines: sourceLines(text).length, text };
  });
  files.forEach(logFileRead);

  if (files.length < MIN_FILES) {
    checkFailed("Step 1 (load directory)", `files>=${MIN_FILES}`, `found ${files.length} .ts/.js files in ${dir}`);
  }
  logCheck(`files>=${MIN_FILES}`);
  log.out(`   ${files.length} files to review`);
  return files;
}

/**
 * The one rendering of raw source that every pass uses, so single-pass and local-pass
 * see identical input and differ only in how many files share one context.
 * Line numbers are printed so a finding can cite a real line, which the answer key checks.
 */
export function numbered(file: SourceFile): string {
  const body = sourceLines(file.text)
    .map((line, i) => `${String(i + 1).padStart(3)}│ ${line}`)
    .join("\n");
  return `=== FILE ${file.name} ===\n${body}`;
}
