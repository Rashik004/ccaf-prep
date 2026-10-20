// task-ids.mjs — finds curriculum task IDs in a prompt and formats their rows

// A task ID such as 1.3 or 4.6, standing alone: not part of 22.17.1, v1.3 or 1.3.5.
// Nor an amount: $2.1, 1.3%. A trailing full stop ("start 1.3.") and an exercise folder
// name (1.3_subagent_invocation) still count.
const TASK_ID = /(?<![\w.$€£])(\d+\.\d+)(?![a-z0-9%]|\.\d)/gi;

/** Most IDs a single prompt injects, so a pasted table cannot flood the context. */
export const MAX_IDS = 5;

/** Known task IDs mentioned in the prompt, first mention first, without repeats. */
export function findTaskIds(prompt, tasks) {
  const known = new Set(tasks.map((t) => t.id));
  const found = [];
  for (const [, id] of prompt.matchAll(TASK_ID)) {
    if (known.has(id) && !found.includes(id)) found.push(id);
    if (found.length === MAX_IDS) break;
  }
  return found;
}

/** The context text for the matched rows. */
export function taskContext(ids, tasks) {
  const rows = ids.map((id) => tasks.find((t) => t.id === id));
  const lines = rows.map(
    (t) => `- ${t.id} ${t.title} | status: ${t.status} | folder: ${t.folder || "(none yet)"} | lesson: ${t.lesson}`
  );
  return ["Curriculum rows for the task IDs in this prompt (docs/curriculum.md):", ...lines].join("\n");
}
