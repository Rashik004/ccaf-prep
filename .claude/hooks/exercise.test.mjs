// exercise.test.mjs — tests for run-evidence and exercise-completeness: library logic, then
// each hook end to end against a scratch exercise folder created inside the repo

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  README_SECTIONS,
  RESULT_SECTIONS,
  completenessProblems,
  exerciseFolderFor,
  exerciseOf,
  headings,
  newestLog,
  sectionProblems,
} from "./lib/exercise.mjs";
import { PROJECT_ROOT } from "./lib/hook-io.mjs";
import { NPM_START, lastRecord, runDir, summariseLog } from "./lib/run-log.mjs";

const HOOKS = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES = join(PROJECT_ROOT, ".claude", "skills", "new-exercise", "templates");
const FIXTURE_LOG = join(HOOKS, "fixtures", "run.log");

function runHook(script, event) {
  const res = spawnSync(process.execPath, [join(HOOKS, script)], { input: JSON.stringify(event), encoding: "utf8" });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, json: res.stdout ? JSON.parse(res.stdout) : undefined };
}

describe("exercise folders", () => {
  test("recognises <domain>/<id>_<title>/ paths only", () => {
    assert.deepEqual(exerciseOf("Agent_Orc/1.3_subagent_invocation/src/a.ts"), { id: "1.3", folder: "Agent_Orc/1.3_subagent_invocation" });
    assert.deepEqual(exerciseOf("Tool_MCP\\2.1_tool_schema\\README.md"), { id: "2.1", folder: "Tool_MCP/2.1_tool_schema" });
    for (const p of ["docs/curriculum.md", "Agent_Orc/notes.md", "Agent_Orc/misc/x.ts", "Other/1.3_x/a.ts", "README.md"]) {
      assert.equal(exerciseOf(p), undefined, p);
    }
  });
  test("walks up from a nested directory to the exercise folder", () => {
    const ex = join(PROJECT_ROOT, "Agent_Orc", "1.3_subagent_invocation");
    assert.equal(exerciseFolderFor(join(ex, "src", "deep"), PROJECT_ROOT), ex);
    assert.equal(exerciseFolderFor(PROJECT_ROOT, PROJECT_ROOT), undefined);
    assert.equal(exerciseFolderFor(tmpdir(), PROJECT_ROOT), undefined);
  });
});

describe("required sections", () => {
  test("reads H2 headings, strips numbering, skips fenced code", () => {
    assert.deepEqual(headings("# T\n## 1. Run\n```\n## not a heading\n```\n### Sub\n## Cost ##\n"), ["Run", "Cost"]);
  });
  test("reports missing and out-of-order sections", () => {
    assert.deepEqual(sectionProblems("## Run\n## What it builds\n", ["What it builds", "Run", "Source files"]), [
      'section "Run" is out of order',
      'section "Source files" is missing',
    ]);
  });
  test("the new-exercise templates satisfy the check", () => {
    assert.deepEqual(sectionProblems(readFileSync(join(TEMPLATES, "README.md"), "utf8"), README_SECTIONS), []);
    assert.deepEqual(sectionProblems(readFileSync(join(TEMPLATES, "RESULT.md"), "utf8"), RESULT_SECTIONS), []);
  });
  test("exercise 1.3, the reference exercise, satisfies the check", () => {
    assert.deepEqual(completenessProblems(join(PROJECT_ROOT, "Agent_Orc", "1.3_subagent_invocation"), "done"), []);
  });
  test("lists every gap of an empty folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "ccaf-ex-"));
    try {
      assert.deepEqual(completenessProblems(dir, "todo"), ["README.md is missing", "RESULT.md is missing", 'curriculum status is still "todo"']);
      assert.ok(completenessProblems(dir, undefined).includes("no row in docs/curriculum.md"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("run logs", () => {
  test("newestLog picks the latest *.log by modification time", () => {
    const dir = mkdtempSync(join(tmpdir(), "ccaf-log-"));
    try {
      mkdirSync(join(dir, "Log"));
      writeFileSync(join(dir, "Log", "b.log"), "b");
      writeFileSync(join(dir, "Log", "a.log"), "a");
      writeFileSync(join(dir, "Log", "c.txt"), "c");
      utimesSync(join(dir, "Log", "b.log"), new Date(2020, 0, 1), new Date(2020, 0, 1));
      assert.equal(newestLog(dir).path, join(dir, "Log", "a.log"));
      assert.equal(newestLog(join(dir, "none")), undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("lastRecord returns the last matching JSON record", () => {
    assert.equal(lastRecord(readFileSync(FIXTURE_LOG, "utf8"), /type=result\b/).num_turns, 4);
    assert.equal(lastRecord("no records", /type=result/), undefined);
  });
  test("summariseLog gives banner, outcome and per-model totals", () => {
    const text = summariseLog(FIXTURE_LOG, statSync(FIXTURE_LOG).size).join("\n");
    assert.match(text, /Run: Compare redbud prices/);
    assert.match(text, /Banner model: claude-sonnet-5-5/);
    assert.match(text, /Outcome: coordinator finished — subtype=success, 414\.7s, 4 turns, \$1\.5080/);
    assert.match(text, /Totals: 414\.7s, 4 turns, \$1\.5080/);
    assert.match(text, /claude-sonnet-5-5: input 32, output 85,425, cache read 391,231, cache write 227,030, \$1\.4610/);
  });
  test("summariseLog says so when there is no result record", () => {
    const dir = mkdtempSync(join(tmpdir(), "ccaf-log-"));
    try {
      const f = join(dir, "x.log");
      writeFileSync(f, "▶ RUN  t\n");
      const text = summariseLog(f, 9).join("\n");
      assert.match(text, /no closing ■ line/);
      assert.match(text, /no result record/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("npm start detection", () => {
  test("matches the forms an exercise run takes", () => {
    for (const c of ["npm start", 'npm start -- "topic"', "npm run start", "npm --prefix x start", "cd a && npm.cmd start"]) {
      assert.ok(NPM_START.test(c), c);
    }
    for (const c of ["npm install", "npm test", "npm run typecheck", "echo restart", "npm i start-server"]) {
      assert.ok(!NPM_START.test(c), c);
    }
  });
  test("finds the run directory from --prefix, cd, or the cwd", () => {
    const cwd = join(PROJECT_ROOT, "docs");
    assert.equal(runDir("npm start", cwd), cwd);
    assert.equal(runDir('cd "../Agent_Orc/1.3_x" && npm start', cwd), join(PROJECT_ROOT, "Agent_Orc", "1.3_x"));
    assert.equal(runDir("cd a; cd ../b && npm start -- x", cwd), join(cwd, "b"));
    assert.equal(runDir("npm --prefix ../Agent_Orc/1.3_x start", cwd), join(PROJECT_ROOT, "Agent_Orc", "1.3_x"));
    assert.equal(runDir("Set-Location ..\\Tool_MCP\\2.1_x; npm start", cwd), join(PROJECT_ROOT, "Tool_MCP", "2.1_x"));
  });
});

// A scratch exercise inside the repo, so both hooks see it through PROJECT_ROOT and git.
const SCRATCH = join(PROJECT_ROOT, "Agent_Orc", "9.9_hook_selftest");

describe("hooks end to end", () => {
  before(() => {
    mkdirSync(join(SCRATCH, "Log"), { recursive: true });
    writeFileSync(join(SCRATCH, "README.md"), "# 9.9\n## What it builds\n## Run\n");
    writeFileSync(join(SCRATCH, "Log", "20261020-120000_run.log"), readFileSync(FIXTURE_LOG));
  });
  after(() => rmSync(SCRATCH, { recursive: true, force: true }));

  test("run-evidence: summarises the fresh log after npm start", () => {
    const r = runHook("run-evidence.mjs", { tool_name: "Bash", tool_input: { command: 'npm start -- "x"' }, cwd: SCRATCH });
    assert.equal(r.code, 0, r.stderr);
    const ctx = r.json.hookSpecificOutput.additionalContext;
    assert.equal(r.json.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(ctx, /Run log: .*20261020-120000_run\.log/);
    assert.match(ctx, /Totals: 414\.7s/);
    assert.match(ctx, /RESULT\.md needs updating/);
    assert.doesNotMatch(ctx, /WARNING/);
  });
  test("run-evidence: warns when the newest log predates the run", () => {
    const f = join(SCRATCH, "Log", "20261020-120000_run.log");
    utimesSync(f, new Date("2020-06-01T00:00:00Z"), new Date("2020-06-01T00:00:00Z"));
    const r = runHook("run-evidence.mjs", { tool_input: { command: "npm start" }, cwd: SCRATCH });
    assert.match(r.json.hookSpecificOutput.additionalContext, /WARNING the newest log was last written 2020-06-01T00:00:00.000Z/);
  });
  test("run-evidence: background runs get a reminder, not a summary", () => {
    const r = runHook("run-evidence.mjs", { tool_input: { command: "npm start", run_in_background: true }, cwd: SCRATCH });
    assert.match(r.json.hookSpecificOutput.additionalContext, /in the background/);
  });
  test("run-evidence: silent for other commands and outside exercises", () => {
    for (const event of [
      { tool_input: { command: "npm test" }, cwd: SCRATCH },
      { tool_input: { command: "npm start" }, cwd: PROJECT_ROOT },
      { tool_input: null },
    ]) {
      const r = runHook("run-evidence.mjs", event);
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, "");
    }
  });

  test("exercise-completeness: blocks once on a changed, incomplete exercise", () => {
    const r = runHook("exercise-completeness.mjs", { hook_event_name: "Stop", stop_hook_active: false });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.decision, "block");
    assert.match(r.json.reason, /Agent_Orc\/9\.9_hook_selftest:/);
    assert.match(r.json.reason, /README\.md: section "What to watch for" is missing/);
    assert.match(r.json.reason, /RESULT\.md is missing/);
    assert.match(r.json.reason, /no row in docs\/curriculum\.md/);
    assert.doesNotMatch(r.json.reason, /1\.3_subagent_invocation/);
  });
  test("exercise-completeness: lets the stop through on the retry", () => {
    const r = runHook("exercise-completeness.mjs", { hook_event_name: "Stop", stop_hook_active: true });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stdout, "");
  });
});
