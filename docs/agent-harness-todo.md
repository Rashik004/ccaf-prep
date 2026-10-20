# Agent harness todo

Claude Code hooks, skills and agents to build for this repo. Each item names the exam task it doubles as practice for, so building the harness is itself study time for Domain 3 (Claude Code configuration) and task 1.5 (hooks).

Scope note: these are **Claude Code** hooks that shape how Claude works *on* this repo. The Agent SDK hooks that exercises for task 1.5 implement live inside those exercises, not here.

Priority: **P1** build before the next exercise, **P2** build once two or three exercises exist, **P3** nice to have.

## Prerequisites

The hooks below assume the conventions in `CLAUDE.md`. Done on 2026-10-20:

- [x] Rename `Agent_Orc/1.3_subagent_invocation/logs/` to `Log/` and drop the per-exercise `.gitignore` (root `.gitignore` now covers `Log/` and `output/`).
- [x] Move root `env.ts` into `common/` and update the import in exercise 1.3.
- [x] Extract the logger from exercise 1.3 into `common/` as the shared request/response logger; keep only the lesson-specific trace events in the exercise. Tests for `common/` run from the repo root with `npm test`.
- [x] Write `RESULT.md` for exercise 1.3 from its latest log, then mark it `done` in `docs/curriculum.md`.
- [x] Remove the stray `log.txt` committed at the repo root.

The 1.3 README and RESULT now have every section `exercise-completeness` checks for (its test suite asserts this).

## Hooks

Configured in `.claude/settings.json`. Scripts live in `.claude/hooks/`, plain Node.js `.mjs` with no dependencies; tests in `.claude/hooks/hooks.test.mjs` run with `npm test`.

Built: `curriculum-status`, `task-id-context`, `protect-generated-paths`, `run-evidence`, `exercise-completeness`.

| P | Event | Matcher | Name | What it does | Why |
|---|---|---|---|---|---|
| P1 | `SessionStart` | | `curriculum-status` | Prints counts of done / in progress / todo tasks and the next three todo IDs from `docs/curriculum.md`. Warns when neither `.env` nor the terminal holds a usable `ANTHROPIC_API_KEY` (same lookup as `common/env.ts`). | Orients every session without re-reading the map; catches a dead key before an API call. |
| P1 | `UserPromptSubmit` | | `task-id-context` | When the prompt contains a task ID (`1.4`, `3.2`), injects that row from the curriculum: title, lesson URL, folder, status. | Makes the lesson page the reference point automatically, per `CLAUDE.md`. |
| P1 | `PreToolUse` | `Write\|Edit\|MultiEdit\|NotebookEdit` | `protect-generated-paths` | Denies writes under an exercise's `Log/` or `output/`, any `node_modules/`, and to `.env`, `.env.*` (except `.env.example`) or `package-lock.json`. Windows aliases (`/f/`, `\\?\`, `\\?\UNC\`, `\\<any host>\F$`, `::$DATA`) resolve to the same check. Bash-tool writes are not covered. | Logs are evidence; they are read, never hand-edited. |
| P2 | `PostToolUse`, `PostToolUseFailure` | `Bash\|PowerShell` | `run-evidence` | After a command containing `npm start`, finds the newest `Log/` file in that folder and prints its path, size, model, token totals and duration, then reminds that `RESULT.md` needs updating. Built in step 5. A command hook cannot dispatch an agent, so it parses the log itself; `/run-exercise` does the `log-analyst` pass. | Closes the loop from run to write-up; the summary line is what `RESULT.md` section 1 needs. |
| P2 | `Stop` | | `exercise-completeness` | If files under an exercise folder changed (uncommitted changes in `git status` stand in for "this session"), checks that `README.md` and `RESULT.md` exist with the required section headings and that the curriculum row is not `todo`. Blocks the stop once with the missing items; honours `stop_hook_active` so it cannot loop. **To do:** also require `Gist_<id>.html` and `Log_data_flow_<id>.html` (exercise 1.3 exempt), with tests. | Enforces the definition of done in `CLAUDE.md`. |
| P2 | `PreToolUse` | `Write\|Edit` | `exercise-folder-naming` | When a write creates a new top-level exercise folder, checks it matches `<Domain>/<d.n>_<snake_title>` and that the ID exists in the curriculum. | Layout stays navigable; task IDs stay the shared vocabulary. |
| P3 | `PreToolUse` | `WebFetch` | `allowed-sources` | Not a hook script: `permissions.allow` entries in `.claude/settings.json` (`WebFetch(domain:claudecertificationguide.com)`, `WebFetch(domain:docs.claude.com)`, `WebFetch(domain:docs.anthropic.com)`) let the study site and Anthropic docs through without a prompt; everything else keeps the default ask. | Fewer permission prompts on the two sources every exercise uses. A permission rule does this with no code, so a hook would only duplicate it. |

Exam practice: hooks as a whole cover task 1.5 (hook lifecycle, blocking vs advisory, exit codes and JSON output).

## Skills

Each is a folder `.claude/skills/<name>/SKILL.md`, invoked as `/<name>`.

| P | Name | Input | What it does | Practises |
|---|---|---|---|---|
| P1 | `new-exercise` | task ID | Dispatches `lesson-researcher`, writes the acceptance behaviours, scaffolds the folder (package.json, tsconfig, `src/` entry wired to `common/`, README and RESULT skeletons with the required headings), sets the curriculum row to `in progress`. Ends by printing the acceptance list for review. | 3.2, 1.6 |
| P1 | `build-exercise` | task ID | Writes `src/` against the acceptance behaviours: settles open points with the user, plans files and a behaviour-to-log-line map, writes small exercises itself and larger ones through subagents (core mechanism `opus`/high, supporting code `sonnet`/medium, data `haiku`/low), then typechecks and runs a fresh-reader readability review. Stops before any paid run. Added after step 5; not in the original plan. | 3.2, 1.6 |
| P1 | `run-exercise` | task ID, optional args | Runs `npm start` in the folder, dispatches `log-analyst` on the newest log, fills RESULT sections 1 to 3 with quoted evidence, reports which acceptance behaviours showed up. | 4.4, 5.6 |
| P1 | `log-analysis` | log path or task ID | Dispatches `log-analyst` and renders its summary: timeline, per-agent prompts, tool calls, handoffs, tokens, cost, anomalies. Chat only; the HTML page from a log is `data-flow`'s job. | 5.1, 5.3 |
| P2 | `gist` | task ID | Reads `src/` and the README acceptance behaviours, writes `Gist_<id>.html` per `CLAUDE.md`: Mermaid program-flow diagram, then the important steps with `file:line` excerpts, what and why. Checks every acceptance behaviour maps to a step. Needs no run, so it can follow `build-exercise` directly. | 3.2, 5.4 |
| P2 | `data-flow` | task ID, optional log path | Takes the log RESULT.md cites (else the newest), dispatches `log-analyst` for its report plus `Call samples`, writes `Log_data_flow_<id>.html` per `CLAUDE.md`: run header, Mermaid sequence diagram, call table, reconstructed request/response pairs with log line citations, limits. `run-exercise` suggests it at the end. | 5.6, 1.3 |
| P2 | `study-notes` | task ID | Fetches the lesson and relevant Anthropic docs, writes RESULT sections 4 and 5: study points in the user's framing, contrasts with neighbouring tasks, open questions. Appends five drill questions to `docs/drills/<id>.md`. | 4.1, 5.5 |
| P2 | `exercise-review` | task ID | Dispatches `exercise-reviewer`; prints findings as file:line with the `CLAUDE.md` rule each one breaks. | 4.6, 3.5 |
| P2 | `progress` | | Rebuilds the status column in `docs/curriculum.md` from folder state (code present, README, RESULT, at least one log) and prints a domain-weighted completion percentage. | 3.1 |
| P3 | `drill` | task ID or domain | Quizzes from the study points in RESULT files and `docs/drills/`, grades the answers, lists weak spots. | 4.2 |

## Agents

Each is a file `.claude/agents/<name>.md`. Agents exist to keep bulky reads out of the main context and to give an unanchored second read.

| P | Name | Tools | Returns (required headings) | Used by |
|---|---|---|---|---|
| P1 | `log-analyst` | Read, Grep, Bash (read-only) | `Run`, `Timeline`, `Prompts sent`, `Tool calls`, `Handoffs`, `Tokens and cost`, `Anomalies`, `Acceptance evidence` | `run-exercise`, `log-analysis`, `data-flow` |
| P2 | `log-analyst` change | | Add an optional `Call samples` heading, returned only when asked: per distinct call kind, the logged request fields (system, messages, tools, model, params) and response (content blocks, stop reason, usage) verbatim with line numbers. Optional so `log-analysis` keeps checking eight headings. | `data-flow` |
| P1 | `lesson-researcher` | WebFetch, Read | `Concepts`, `Acceptance behaviours`, `Suggested scenario`, `Anthropic doc links`, `Neighbouring tasks` | `new-exercise`, `study-notes` |
| P2 | `exercise-reviewer` | Read, Grep, Glob | `Layout`, `Code rules`, `Logging rules`, `README`, `RESULT`, each a list of file:line findings | `exercise-review`, optionally `exercise-completeness` hook |
| P3 | `study-note-writer` | Read, Edit (RESULT.md only) | `Study points`, `Contrasts`, `Open questions` | `study-notes` |

The built-in `claude-code-guide` agent already covers Claude Code, Agent SDK and API questions. Reach for it instead of writing an equivalent.

## Suggested build order

1. Prerequisites, so the conventions the hooks check actually hold.
2. ~~`curriculum-status`, `task-id-context`, `protect-generated-paths`~~ (built).
3. ~~`log-analyst` agent, then `log-analysis` skill. Validate on the existing 1.3 logs.~~ (built)
4. ~~`lesson-researcher` agent, then `new-exercise` skill.~~ (built; use it to start 1.1)
5. ~~`run-exercise`, `run-evidence` hook, `exercise-completeness` hook.~~ (built)
6. `log-analyst` `Call samples` heading, then `gist` and `data-flow` skills, then the `exercise-completeness` update. The two pages are part of done from 1.1 on; until the skills exist, write them by hand per `CLAUDE.md`.
7. Everything else P2 and P3 as the matching curriculum task comes up.
