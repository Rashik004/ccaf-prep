// exercise.test.mjs — tests for run-evidence and exercise-completeness: library logic, then
// each hook end to end against a scratch git repository (CCAF_HOOK_ROOT), never the real repo

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
    for (const c of [
      "npm start",
      'npm start -- "topic"',
      "npm run start",
      "npm --prefix x start",
      "npm -w foo start",
      "cd a && npm.cmd start",
      "npm start>out.txt",
      "(cd X && npm start)",
      "npm start 2>&1 | tail",
      "DEBUG_TRACE=0 npm start",
      "time npm start",
    ]) {
      assert.ok(NPM_START.test(c), c);
    }
    for (const c of ["npm install", "npm test", "npm run typecheck", "echo restart", "npm i start-server", "echo npm start", "git commit -m 'npm start fix'"]) {
      assert.ok(!NPM_START.test(c), c);
    }
  });
  test("finds the run directory from --prefix, cd, or the cwd", () => {
    const cwd = join(PROJECT_ROOT, "docs");
    const ex = join(PROJECT_ROOT, "Agent_Orc", "1.3_x");
    assert.equal(runDir("npm start", cwd, PROJECT_ROOT), cwd);
    assert.equal(runDir('cd "../Agent_Orc/1.3_x" && npm start', cwd, PROJECT_ROOT), ex);
    assert.equal(runDir("cd a; cd ../b && npm start -- x", cwd, PROJECT_ROOT), join(cwd, "b"));
    assert.equal(runDir("npm --prefix ../Agent_Orc/1.3_x start", cwd, PROJECT_ROOT), ex);
    assert.equal(runDir("npm start --prefix ../Agent_Orc/1.3_x", cwd, PROJECT_ROOT), ex);
    assert.equal(runDir("Set-Location ..\\Tool_MCP\\2.1_x; npm start", cwd, PROJECT_ROOT), join(PROJECT_ROOT, "Tool_MCP", "2.1_x"));
    assert.equal(runDir("Set-Location -Path ../Agent_Orc/1.3_x; npm start", cwd, PROJECT_ROOT), ex);
    assert.equal(runDir("Push-Location ../Agent_Orc/1.3_x; npm start", cwd, PROJECT_ROOT), ex);
    assert.equal(runDir('cd "$CLAUDE_PROJECT_DIR/Agent_Orc/1.3_x" && npm start', cwd, PROJECT_ROOT), ex);
    assert.equal(runDir("echo cd x; npm start", cwd, PROJECT_ROOT), cwd);
  });
  test("summariseLog skips malformed per-model usage", () => {
    const dir = mkdtempSync(join(tmpdir(), "ccaf-log-"));
    try {
      const f = join(dir, "x.log");
      writeFileSync(f, '===== stream[1] type=result =====\n{\n  "modelUsage": { "a": null, "b": "x" }\n}\n');
      assert.match(summariseLog(f, 9).join("\n"), /Totals: \?/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * A scratch git repository with the hooks' view of a repo: a curriculum with one row,
 * a committed complete exercise, and an uncommitted incomplete one. The hooks run against
 * it through CCAF_HOOK_ROOT, so the real repo is never touched.
 */
function scratchRepo() {
  const root = mkdtempSync(join(tmpdir(), "ccaf-repo-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "curriculum.md"), "| 1.1 | Done one | https://x | `Agent_Orc/1.1_done` | done |\n");
  const done = join(root, "Agent_Orc", "1.1_done");
  mkdirSync(done, { recursive: true });
  writeFileSync(join(done, "README.md"), readFileSync(join(TEMPLATES, "README.md")));
  writeFileSync(join(done, "RESULT.md"), readFileSync(join(TEMPLATES, "RESULT.md")));
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
  const wip = join(root, "Agent_Orc", "9.9_hook_selftest");
  mkdirSync(join(wip, "Log"), { recursive: true });
  writeFileSync(join(wip, "README.md"), "# 9.9\n## What it builds\n## Run\n");
  writeFileSync(join(wip, "Log", "20261020-120000_run.log"), readFileSync(FIXTURE_LOG));
  return { root, wip, done, git };
}

function runIn(root, script, event) {
  const res = spawnSync(process.execPath, [join(HOOKS, script)], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, CCAF_HOOK_ROOT: root },
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, json: res.stdout ? JSON.parse(res.stdout) : undefined };
}

describe("hooks end to end", () => {
  let repo;
  before(() => (repo = scratchRepo()));
  after(() => rmSync(repo.root, { recursive: true, force: true }));

  test("run-evidence: summarises the fresh log after npm start", () => {
    const r = runIn(repo.root, "run-evidence.mjs", {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: 'npm start -- "x"' },
      cwd: repo.wip,
      duration_ms: 60000,
    });
    assert.equal(r.code, 0, r.stderr);
    const ctx = r.json.hookSpecificOutput.additionalContext;
    assert.equal(r.json.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(ctx, /Run log: .*20261020-120000_run\.log/);
    assert.match(ctx, /Totals: 414\.7s/);
    assert.match(ctx, /RESULT\.md needs updating/);
    assert.doesNotMatch(ctx, /WARNING/);
  });
  test("run-evidence: reports a failed run under PostToolUseFailure", () => {
    const r = runIn(repo.root, "run-evidence.mjs", { hook_event_name: "PostToolUseFailure", tool_input: { command: "npm start" }, cwd: repo.wip });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.hookSpecificOutput.hookEventName, "PostToolUseFailure");
    assert.match(r.json.hookSpecificOutput.additionalContext, /exited with an error/);
  });
  test("run-evidence: takes the event cwd when the cd already happened", () => {
    const r = runIn(repo.root, "run-evidence.mjs", { tool_input: { command: "cd ../../Agent_Orc/9.9_hook_selftest && npm start" }, cwd: repo.wip });
    assert.match(r.json.hookSpecificOutput.additionalContext, /9\.9_hook_selftest/);
  });
  test("run-evidence: warns when the newest log predates the run", () => {
    const f = join(repo.wip, "Log", "20261020-120000_run.log");
    const old = new Date(Date.now() - 90_000);
    utimesSync(f, old, old);
    const r = runIn(repo.root, "run-evidence.mjs", { tool_input: { command: "npm start" }, cwd: repo.wip, duration_ms: 30_000 });
    assert.match(r.json.hookSpecificOutput.additionalContext, /WARNING the newest log was last written/);
    utimesSync(f, new Date(), new Date());
  });
  test("run-evidence: follows a cd out of one exercise into another", () => {
    const other = join(repo.root, "Agent_Orc", "9.8_other");
    mkdirSync(join(other, "Log"), { recursive: true });
    writeFileSync(join(other, "Log", "a.log"), readFileSync(FIXTURE_LOG));
    try {
      const r = runIn(repo.root, "run-evidence.mjs", { tool_input: { command: "cd ../9.8_other && npm start" }, cwd: repo.wip });
      assert.match(r.json.hookSpecificOutput.additionalContext, /9\.8_other/);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });
  test("run-evidence: background runs get a reminder, not a summary", () => {
    const r = runIn(repo.root, "run-evidence.mjs", { tool_input: { command: "npm start", run_in_background: true }, cwd: repo.wip });
    assert.match(r.json.hookSpecificOutput.additionalContext, /in the background/);
  });
  test("run-evidence: silent for other commands and outside exercises", () => {
    for (const event of [
      { tool_input: { command: "npm test" }, cwd: repo.wip },
      { tool_input: { command: "echo npm start" }, cwd: repo.wip },
      { tool_input: { command: "npm start" }, cwd: repo.root },
      { tool_input: null },
    ]) {
      const r = runIn(repo.root, "run-evidence.mjs", event);
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, "");
    }
  });

  test("exercise-completeness: blocks once on a changed, incomplete exercise", () => {
    const r = runIn(repo.root, "exercise-completeness.mjs", { hook_event_name: "Stop", stop_hook_active: false });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.decision, "block");
    assert.match(r.json.reason, /Agent_Orc\/9\.9_hook_selftest:/);
    assert.match(r.json.reason, /README\.md: section "What to watch for" is missing/);
    assert.match(r.json.reason, /RESULT\.md is missing/);
    assert.match(r.json.reason, /no row in docs\/curriculum\.md/);
    assert.match(r.json.reason, /Start no exercise run/);
    assert.doesNotMatch(r.json.reason, /1\.1_done/);
  });
  test("exercise-completeness: lets the stop through on the retry or while a run is in the background", () => {
    for (const event of [{ stop_hook_active: true }, { stop_hook_active: false, background_tasks: [{ id: "b1" }] }]) {
      const r = runIn(repo.root, "exercise-completeness.mjs", event);
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, "");
    }
  });
  test("exercise-completeness: a deleted exercise is not unfinished work", () => {
    rmSync(repo.done, { recursive: true, force: true });
    const r = runIn(repo.root, "exercise-completeness.mjs", { stop_hook_active: false });
    assert.doesNotMatch(r.json.reason, /1\.1_done/);
    repo.git("checkout", "--", ".");
  });
  test("exercise-completeness: silent outside a git repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "ccaf-nogit-"));
    try {
      mkdirSync(join(dir, "docs"));
      writeFileSync(join(dir, "docs", "curriculum.md"), "");
      const r = runIn(dir, "exercise-completeness.mjs", { stop_hook_active: false });
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, "");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
