// exercise.mjs — exercise folders, their required write-up sections, and their run logs

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Domain folders from CLAUDE.md. An exercise is <domain>/<task-id>_<snake_title>/.
export const DOMAIN_DIRS = ["Agent_Orc", "Tool_MCP", "CC_Config", "Prompt_Eng", "Context_Mgmt"];
const EXERCISE_DIR = /^(\d+\.\d+)_[a-z0-9_]+$/;

// The H2 sections CLAUDE.md requires, in order. A heading matches when its text, after an
// optional "1. " number, starts with the name. The new-exercise templates use these headings.
export const README_SECTIONS = ["What it builds", "Run", "What to watch for", "Troubleshooting", "Source files"];
export const RESULT_SECTIONS = ["Run", "Cost", "What happened", "Acceptance behaviours", "Study points", "Open questions"];

/**
 * The exercise a repo-relative path belongs to, as { id, folder } with "/" separators,
 * or undefined when the path is not inside a <domain>/<id>_<title>/ folder.
 */
export function exerciseOf(relPath) {
  const [domain, dir] = relPath.split(/[\\/]/);
  if (!DOMAIN_DIRS.includes(domain) || !dir) return undefined;
  const m = EXERCISE_DIR.exec(dir);
  return m ? { id: m[1], folder: `${domain}/${dir}` } : undefined;
}

/** The exercise folder holding `dir` (absolute), walking up to `root`. */
export function exerciseFolderFor(dir, root) {
  const rel = relative(root, resolve(dir));
  if (rel.startsWith(`..${sep}`) || rel === "..") return undefined;
  const ex = exerciseOf(rel);
  return ex ? join(root, ...ex.folder.split("/")) : undefined;
}

/** The H2 headings of a markdown text, numbering stripped. Fenced code is skipped. */
export function headings(markdown) {
  const found = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = !fenced && /^##\s+(?:\d+\.\s*)?(.+?)\s*#*\s*$/.exec(line);
    if (m) found.push(m[1]);
  }
  return found;
}

/** Required sections that are missing or out of order, as readable problems. */
export function sectionProblems(markdown, required) {
  const found = headings(markdown);
  const problems = [];
  let cursor = 0;
  for (const name of required) {
    const at = found.findIndex((h, i) => i >= cursor && h.toLowerCase().startsWith(name.toLowerCase()));
    if (at === -1) {
      const anywhere = found.some((h) => h.toLowerCase().startsWith(name.toLowerCase()));
      problems.push(anywhere ? `section "${name}" is out of order` : `section "${name}" is missing`);
    } else {
      cursor = at + 1;
    }
  }
  return problems;
}

/** Everything the definition of done in CLAUDE.md still lacks for one exercise. */
export function completenessProblems(folderAbs, status) {
  const problems = [];
  for (const [file, required] of [
    ["README.md", README_SECTIONS],
    ["RESULT.md", RESULT_SECTIONS],
  ]) {
    const path = join(folderAbs, file);
    if (!existsSync(path)) problems.push(`${file} is missing`);
    else problems.push(...sectionProblems(readFileSync(path, "utf8"), required).map((p) => `${file}: ${p}`));
  }
  if (status === undefined) problems.push("no row in docs/curriculum.md");
  else if (status === "todo") problems.push('curriculum status is still "todo"');
  return problems;
}

/** The newest *.log in the exercise's Log/ folder, or undefined. */
export function newestLog(folderAbs) {
  const dir = join(folderAbs, "Log");
  if (!existsSync(dir)) return undefined;
  let best;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".log")) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (!stat.isFile()) continue;
    if (!best || stat.mtimeMs > best.mtimeMs) best = { path, mtimeMs: stat.mtimeMs, size: stat.size };
  }
  return best;
}

/**
 * Exercises with changes since the last commit. Claude Code gives a Stop hook no list of
 * the session's edits, so uncommitted changes (tracked or untracked, never ignored) stand in.
 */
export function changedExercises(root) {
  let out;
  try {
    // --no-optional-locks: a status run must not collide with a commit in another terminal.
    out = execFileSync("git", ["--no-optional-locks", "status", "--porcelain", "-z", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return []; // no git, or not a repository: nothing to check
  }
  const folders = new Map();
  // -z entries are "XY path"; a rename adds the old path as its own NUL-separated entry.
  for (const entry of out.split("\0")) {
    const ex = exerciseOf(entry.length > 3 && entry[2] === " " ? entry.slice(3) : entry);
    // A deleted or renamed-away exercise is not unfinished work.
    if (ex && existsSync(join(root, ...ex.folder.split("/")))) folders.set(ex.folder, ex);
  }
  return [...folders.values()];
}
