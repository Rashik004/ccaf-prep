// hooks.test.mjs — tests for the Claude Code hooks: library logic against a fixture
// curriculum, then each hook end to end against the live repo

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readTasks } from "./lib/curriculum.mjs";
import { PROJECT_ROOT } from "./lib/hook-io.mjs";
import { canonical, protectionReason } from "./lib/protected-paths.mjs";
import { keyWarning, statusText } from "./lib/status.mjs";
import { MAX_IDS, findTaskIds, taskContext } from "./lib/task-ids.mjs";

const HOOKS = fileURLToPath(new URL(".", import.meta.url));
// A fixed curriculum, so progress in docs/curriculum.md never turns these tests red.
const tasks = readTasks(join(HOOKS, "fixtures", "curriculum.md"));
const windows = process.platform === "win32";

/** Runs a hook script as Claude Code does: event JSON on stdin, answer on stdout. */
function runHook(script, event) {
  const res = spawnSync(process.execPath, [join(HOOKS, script)], {
    input: typeof event === "string" ? event : JSON.stringify(event),
    encoding: "utf8",
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, json: res.stdout ? JSON.parse(res.stdout) : undefined };
}

describe("curriculum", () => {
  test("reads every task row with its fields", () => {
    assert.deepEqual(tasks.map((t) => t.id), ["1.1", "1.2", "1.3", "2.1", "2.2", "4.6", "6.1"]);
    assert.deepEqual(tasks[1], {
      id: "1.2",
      title: "Beta",
      lesson: "https://example.test/1-2",
      folder: "Agent_Orc/1.2_beta",
      status: "in progress",
    });
    assert.equal(tasks[0].folder, "");
  });

  test("the live curriculum parses into well-formed rows", () => {
    const live = readTasks();
    assert.ok(live.length > 0);
    for (const t of live) {
      assert.match(t.id, /^\d+\.\d+$/);
      assert.ok(["todo", "in progress", "done"].includes(t.status), `${t.id}: ${t.status}`);
      assert.match(t.lesson, /^https:\/\//, t.id);
    }
  });
});

describe("curriculum-status", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccaf-hooks-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const env = (name, body) => {
    const file = join(dir, name);
    writeFileSync(file, body);
    return file;
  };

  test("warns when .env is missing and the terminal has no key", () => {
    assert.match(keyWarning(join(dir, "absent.env"), undefined), /\.env is missing/);
  });
  test("warns on the placeholder key", () => {
    assert.match(keyWarning(env("p.env", 'ANTHROPIC_API_KEY="YourAnthropicApiKey"\n'), ""), /placeholder/);
  });
  test("warns when .env lacks the key", () => {
    assert.match(keyWarning(env("n.env", 'ANTHROPIC_MODEL="x"\n'), undefined), /no ANTHROPIC_API_KEY value/);
  });
  test("treats a placeholder in the terminal as no key", () => {
    assert.ok(keyWarning(join(dir, "absent.env"), "YourAnthropicApiKey"));
  });
  test("accepts a real key in .env or in the terminal", () => {
    assert.equal(keyWarning(env("k.env", 'ANTHROPIC_API_KEY="sk-ant-test"\n'), undefined), undefined);
    assert.equal(keyWarning(join(dir, "absent.env"), "sk-ant-test"), undefined);
  });

  test("counts statuses and lists the next three todo IDs", () => {
    const text = statusText(tasks);
    assert.match(text, /1 done, 1 in progress, 5 todo, 7 total/);
    assert.match(text, /In progress: 1\.2 Beta\./);
    assert.match(text, /Next todo: 1\.1 Alpha; 2\.1 Delta; 2\.2 Epsilon\./);
    assert.doesNotMatch(text, /4\.6/);
  });
  test("warns instead of reporting zero tasks when nothing parses", () => {
    assert.match(statusText([]), /^WARNING: docs\/curriculum\.md has no task rows/);
  });
  test("says so when nothing is left to do", () => {
    assert.match(statusText([{ id: "1.1", title: "A", status: "done" }]), /No todo tasks left\./);
  });

  test("end to end: adds SessionStart context", () => {
    const r = runHook("curriculum-status.mjs", { hook_event_name: "SessionStart", source: "startup" });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(r.json.hookSpecificOutput.additionalContext, /^Curriculum \(docs\/curriculum\.md\): \d+ done/);
  });
  test("end to end: malformed stdin still gets the report", () => {
    const r = runHook("curriculum-status.mjs", "not json");
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.json.hookSpecificOutput.additionalContext, /^Curriculum/);
  });
});

describe("task-id-context", () => {
  test("finds known IDs, first mention first, no repeats", () => {
    assert.deepEqual(findTaskIds("do 2.1 after 1.2, then 2.1 again", tasks), ["2.1", "1.2"]);
  });
  test("accepts IDs at sentence end, in brackets and in folder names", () => {
    assert.deepEqual(findTaskIds("start 1.3. Also (4.6) and Agent_Orc/1.2_beta", tasks), ["1.3", "4.6", "1.2"]);
  });
  test("ignores versions, amounts and unknown IDs", () => {
    assert.deepEqual(findTaskIds("node 22.17.1, v1.3, 1.3.5, 2.10 USD, 1.1x, $2.1, up 1.3%, 9.9", tasks), []);
  });
  test("stops at MAX_IDS", () => {
    assert.equal(findTaskIds("1.1 1.2 1.3 2.1 2.2 4.6 6.1", tasks).length, MAX_IDS);
  });
  test("formats a row with status, folder and lesson", () => {
    const text = taskContext(["1.3", "1.1"], tasks);
    assert.match(text, /- 1\.3 Gamma \| status: done \| folder: Agent_Orc\/1\.3_gamma \| lesson: https:\/\/example\.test\/1-3/);
    assert.match(text, /- 1\.1 Alpha \| status: todo \| folder: \(none yet\)/);
  });

  test("end to end: adds UserPromptSubmit context for a task ID", () => {
    const id = readTasks()[0].id;
    const r = runHook("task-id-context.mjs", { hook_event_name: "UserPromptSubmit", prompt: `start ${id}` });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.match(r.json.hookSpecificOutput.additionalContext, new RegExp(`- ${id.replace(".", "\\.")} `));
  });
  test("end to end: silent without a task ID or without a prompt", () => {
    for (const event of [{ prompt: "hello" }, { prompt: null }, {}]) {
      const r = runHook("task-id-context.mjs", event);
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, "");
    }
  });
});

describe("protect-generated-paths", () => {
  const root = PROJECT_ROOT;
  const ex = join(root, "Agent_Orc", "1.3_subagent_invocation");
  const rootEnv = join(root, ".env");

  for (const p of [
    join(ex, "Log", "2610201200.log"),
    join(ex, "LOG", "sub", "x.md"),
    join(ex, "output", "report.md"),
    join(root, "Context_Mgmt", "5.1_x", "Output", "a.json"),
    join(ex, "node_modules", "pkg", "index.js"),
    join(root, "common", "node_modules", "x.js"),
    rootEnv,
    join(root, ".env.local"),
    join(ex, "package-lock.json"),
    join(root, "package-lock.json"),
    join(root, "..dotted", ".env"), // inside the repo although the relative path starts with ".."
  ]) {
    test(`denies ${p.slice(root.length)}`, () => assert.ok(protectionReason(p, root)));
  }

  for (const p of [
    join(ex, "src", "log.ts"),
    join(ex, "src", "output", "render.ts"),
    join(root, "common", "output", "fmt.ts"),
    join(root, "docs", "log", "notes.md"),
    join(root, "common", "log.ts"),
    join(root, "example.env"),
    join(root, ".env.example"),
    join(ex, "RESULT.md"),
    join(tmpdir(), "Log", "outside.log"),
    join(root, ".claude", "hooks", "output", "x.mjs"),
    join(root, "docs", "curriculum", "Log", "x.md"),
  ]) {
    test(`allows ${p}`, () => assert.equal(protectionReason(p, root), undefined));
  }

  test("resolves relative paths against cwd", () => {
    assert.ok(protectionReason("Log/a.log", root, ex));
    assert.equal(protectionReason("src/a.ts", root, ex), undefined);
    assert.ok(protectionReason("../.env", root, join(root, "common")));
  });

  test("Windows aliases of a protected file are denied", { skip: !windows && "Windows path forms" }, () => {
    const drive = rootEnv.slice(0, 2);
    const rest = rootEnv.slice(2);
    for (const alias of [
      `\\\\?\\${rootEnv}`,
      `\\\\.\\${rootEnv}`,
      `\\\\localhost\\${drive[0]}$${rest}`,
      `${rootEnv}::$DATA`,
      `${rootEnv}:stream`,
      rootEnv.replace(/\\/g, "/"),
      `/${drive[0].toLowerCase()}${rest.replace(/\\/g, "/")}`,
      `\\\\?\\UNC\\localhost\\${drive[0]}$${rest}`,
      `\\\\.\\UNC\\localhost\\${drive[0]}$${rest}`,
      `\\\\MYHOST\\${drive[0]}$${rest}`,
      `\\\\[::1]\\${drive[0]}$${rest}`,
    ]) {
      assert.ok(protectionReason(alias, root), alias);
    }
    assert.equal(canonical("C:\\a\\b.txt"), "C:\\a\\b.txt");
  });

  test("end to end: denies with a reason", () => {
    const r = runHook("protect-generated-paths.mjs", {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: join(ex, "Log", "a.log"), content: "x" },
      cwd: root,
    });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.hookSpecificOutput.permissionDecision, "deny");
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /run log/);
  });
  test("end to end: silent for an allowed path or a missing tool_input", () => {
    for (const event of [
      { tool_name: "Edit", tool_input: { file_path: join(ex, "README.md") }, cwd: root },
      { tool_name: "Write", tool_input: null },
    ]) {
      const r = runHook("protect-generated-paths.mjs", event);
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, "");
    }
  });
  test("end to end: covers NotebookEdit's notebook_path", () => {
    const r = runHook("protect-generated-paths.mjs", {
      tool_name: "NotebookEdit",
      tool_input: { notebook_path: join(ex, "output", "n.ipynb") },
      cwd: root,
    });
    assert.equal(r.json.hookSpecificOutput.permissionDecision, "deny");
  });
  test("end to end: malformed stdin exits 1 with a stderr note", () => {
    const r = runHook("protect-generated-paths.mjs", "not json");
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[protect-generated-paths\] hook failed/);
  });
});
