// log.test.ts — the shared run log: file placement, sinks, truncation, resilience.
// Run from the repo root: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openRunLog } from "./log";

const silent = () => {};
const freshRoot = () => mkdtempSync(join(tmpdir(), "runlog-"));

test("default file sits in <exerciseRoot>/Log and appears on the first write", () => {
  const log = openRunLog(freshRoot(), { stderr: silent });
  assert.match(log.file, /[\\/]Log[\\/]\d{8}-\d{6}_run\.log$/);
  assert.equal(existsSync(log.file), false);
  log.out("hello");
  assert.equal(readFileSync(log.file, "utf8"), "hello\n");
});

test("accepts a file: URL for the exercise root, as src/ files pass it", () => {
  const root = freshRoot();
  const log = openRunLog(pathToFileURL(`${root}/`), { stderr: silent });
  assert.ok(log.file.startsWith(root), `${log.file} should start with ${root}`);
});

test("quiet keeps the file complete and stderr down to headlines", () => {
  const lines: string[] = [];
  const log = openRunLog(freshRoot(), { quiet: true, stderr: (l) => lines.push(l) });
  log.out("trace");
  log.headline("head");
  assert.deepEqual(lines, ["head"]);
  assert.equal(readFileSync(log.file, "utf8"), "trace\nhead\n");
});

test("quote truncates on stderr only; the file keeps the whole text", () => {
  const lines: string[] = [];
  const log = openRunLog(freshRoot(), { quoteMax: 5, stderr: (l) => lines.push(l) });
  log.quote("abcdefghij");
  assert.ok(readFileSync(log.file, "utf8").includes("   > abcdefghij"));
  assert.ok(lines[0].startsWith("   > abcde"));
  assert.ok(lines[0].includes("5 more chars"));
});

test("stream writes a labelled JSON record and survives circular payloads", () => {
  const log = openRunLog(freshRoot(), { stderr: silent });
  const payload: Record<string, unknown> = { type: "assistant", n: 1 };
  payload.self = payload;
  log.stream(3, payload);
  const text = readFileSync(log.file, "utf8");
  assert.ok(text.includes("===== stream[3] type=assistant ====="));
  assert.ok(text.includes('"self": "[circular]"'));
});

test("dump goes to the file always and to stderr only with raw on", () => {
  const quietLines: string[] = [];
  const quietLog = openRunLog(freshRoot(), { raw: false, stderr: (l) => quietLines.push(l) });
  quietLog.dump("payload", "body text");
  assert.ok(readFileSync(quietLog.file, "utf8").includes("=== payload ===\nbody text\n=== END ==="));
  assert.deepEqual(quietLines, []);

  const rawLines: string[] = [];
  const rawLog = openRunLog(freshRoot(), { raw: true, stderr: (l) => rawLines.push(l) });
  rawLog.dump("payload", "body text");
  assert.equal(rawLines.length, 1);
});

test("a broken file sink is reported once and never throws", () => {
  const root = freshRoot();
  writeFileSync(join(root, "Log"), "a file where the folder should be");
  const lines: string[] = [];
  const log = openRunLog(root, { stderr: (l) => lines.push(l) });
  assert.doesNotThrow(() => {
    log.out("a");
    log.out("b");
  });
  assert.equal(lines.filter((l) => l.includes("file sink disabled")).length, 1);
  assert.deepEqual(lines.filter((l) => l === "a" || l === "b"), ["a", "b"]);
});
