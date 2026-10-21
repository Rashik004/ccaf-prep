// progress.mjs — the progress part of curriculum-status: exam-weighted completion, and the
// curriculum rows whose status disagrees with what the exercise folder holds. Report only:
// docs/curriculum.md is never rewritten. Log/ is never read: it is gitignored, so a fresh
// clone has no logs and every done task would look unfinished.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DOMAIN_DIRS, completenessProblems, exerciseOf } from "./exercise.mjs";

const domainOf = (id) => id.split(".")[0];

/** One line: Σ weight × done/total over the weighted domains, then done/total per domain. */
export function weightedProgress(tasks, weights) {
  if (!weights.size) return "Weighted progress: no domain weights found in docs/curriculum.md";
  let percent = 0;
  const parts = [];
  for (const [domain, weight] of weights) {
    const inDomain = tasks.filter((t) => domainOf(t.id) === domain);
    if (!inDomain.length) continue;
    const done = inDomain.filter((t) => t.status === "done").length;
    percent += (weight * done) / inDomain.length;
    parts.push(`D${domain} ${done}/${inDomain.length}`);
  }
  return `Weighted progress: ${percent.toFixed(1)}% (${parts.join(", ")})`;
}

/** Exercise folders on disk, as Map<task id, folder>. */
function foldersOnDisk(root) {
  const found = new Map();
  for (const domain of DOMAIN_DIRS) {
    const dir = join(root, domain);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const ex = entry.isDirectory() && exerciseOf(`${domain}/${entry.name}`);
      if (ex) found.set(ex.id, ex.folder);
    }
  }
  return found;
}

/** One line per curriculum row whose status disagrees with its folder, in file order. */
export function progressMismatches(tasks, root) {
  const onDisk = foldersOnDisk(root);
  const lines = [];
  for (const { id, folder, status } of tasks) {
    if (status === "todo") {
      if (onDisk.has(id)) lines.push(`${id} is "todo" but folder ${onDisk.get(id)} exists`);
      continue;
    }
    if (status !== "in progress" && status !== "done") continue;
    if (!folder) {
      lines.push(`${id} is "${status}" but has no folder in docs/curriculum.md`);
      continue;
    }
    const abs = join(root, ...folder.split("/"));
    if (!existsSync(abs)) {
      lines.push(`${id} is "${status}" but its folder ${folder} is missing`);
      continue;
    }
    const problems = completenessProblems(abs, status, id);
    if (status === "done" && problems.length) lines.push(`${id} is "done" but: ${problems.join("; ")}`);
    if (status === "in progress" && !problems.length) {
      lines.push(`${id} is "in progress" but looks done: set it to done after you read the write-ups`);
    }
  }
  return lines;
}

/** The progress section of the SessionStart report. */
export function progressText(tasks, weights, root) {
  const mismatches = progressMismatches(tasks, root);
  const lines = [weightedProgress(tasks, weights)];
  if (mismatches.length) lines.push("Status vs folders:", ...mismatches.map((m) => `- ${m}`));
  return lines.join("\n");
}
