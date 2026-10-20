// curriculum.mjs — reads the task rows out of docs/curriculum.md

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "./hook-io.mjs";

export const CURRICULUM_FILE = join(PROJECT_ROOT, "docs", "curriculum.md");

// A task row: | 1.3 | Title | URL | `folder` or empty | status |
const ROW = /^\|\s*(\d+\.\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/;

/** Every task row in file order, as { id, title, lesson, folder, status }. */
export function readTasks(file = CURRICULUM_FILE) {
  const tasks = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = ROW.exec(line);
    if (!m) continue;
    const [, id, title, lesson, folder, status] = m;
    tasks.push({
      id,
      title: title.trim(),
      lesson: lesson.trim(),
      folder: folder.trim().replace(/^`|`$/g, ""),
      status: status.trim(),
    });
  }
  return tasks;
}
