// task-id-context.mjs — UserPromptSubmit hook: when a prompt names a task ID, adds that
// task's curriculum row so the lesson page is the reference point without a lookup.

import { readTasks } from "./lib/curriculum.mjs";
import { addContext, readEvent, runHook } from "./lib/hook-io.mjs";
import { findTaskIds, taskContext } from "./lib/task-ids.mjs";

runHook("task-id-context", () => {
  const { prompt } = readEvent();
  if (typeof prompt !== "string") return;
  const tasks = readTasks();
  const ids = findTaskIds(prompt, tasks);
  if (ids.length) addContext("UserPromptSubmit", taskContext(ids, tasks));
});
