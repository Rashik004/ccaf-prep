// exercise-completeness.mjs — Stop hook: when an exercise folder has uncommitted changes,
// checks the definition of done from CLAUDE.md (README.md and RESULT.md with their
// sections in order, curriculum row past "todo") and blocks the stop once with what is
// missing. On the retry Claude Code sets stop_hook_active, and the hook lets the stop go.

import { join } from "node:path";
import { readTasks } from "./lib/curriculum.mjs";
import { changedExercises, completenessProblems } from "./lib/exercise.mjs";
import { PROJECT_ROOT, readEvent, respond, runHook } from "./lib/hook-io.mjs";

runHook("exercise-completeness", () => {
  const event = readEvent();
  if (event.stop_hook_active) return; // already blocked once this turn: let the stop happen

  const statusById = new Map(readTasks().map((t) => [t.id, t.status]));
  const report = [];
  for (const ex of changedExercises(PROJECT_ROOT)) {
    const problems = completenessProblems(join(PROJECT_ROOT, ...ex.folder.split("/")), statusById.get(ex.id));
    if (problems.length) report.push(`${ex.folder}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
  if (!report.length) return;

  respond({
    decision: "block",
    reason:
      "exercise-completeness: changed exercise folders are not done per CLAUDE.md.\n" +
      `${report.join("\n")}\n` +
      "Finish these, or tell the user what is left and why. This check blocks only once per turn.",
  });
});
