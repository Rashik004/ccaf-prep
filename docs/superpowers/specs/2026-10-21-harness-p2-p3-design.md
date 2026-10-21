# Harness P2/P3: finish and freeze

Date: 2026-10-21. Source list: `docs/agent-harness-todo.md` (P1 items and build steps 1–5 are already built).

## Intent

Finish the Claude Code harness for this repo in one push, so that afterwards the user only studies: new exercise → build → run → write-ups → study notes → drill. Every remaining P2/P3 item is either **built now** or **dropped for good**. Nothing is left as "later", because a deferred item would pull the user back into harness work.

Success: one session per exercise runs the whole loop through skills without the user writing an HTML page or a study note by hand, and `docs/agent-harness-todo.md` says the harness is frozen.

## Goals

1. `log-analyst` gains an optional `Call samples` heading.
2. `/gist <id>` writes `Gist_<id>.html`.
3. `/data-flow <id> [log]` writes `Log_data_flow_<id>.html`.
4. `exercise-completeness` also requires both HTML pages.
5. `/study-notes <id>` writes RESULT sections 5–6 and five drill questions.
6. `/drill [id | domain]` quizzes the user from the drill bank and RESULT study points.
7. `curriculum-status` hook gains the `progress` report (status vs. folder state, domain-weighted percentage).
8. Small fixes that close gaps in the existing loop (see "Gap fixes").
9. Docs updated: todo frozen, `CLAUDE.md` layout, root `README.md` harness section.

## Non-goals

- Finishing exercise 1.1 itself. 1.1 is only the test bed: its two pages and study notes are produced as validation output.
- Rewriting 1.3's `http-flow.html` / `subagent-prompting-guide.html`. 1.3 stays exempt from the HTML pages.
- Automated tests for skills. Skills are validated by one real run each, not by a test suite.
- Any new P1-style infrastructure (MCP servers, CI, plugins).

## Anti-goals (a failure even if it works)

- A harness that keeps asking for maintenance: brittle parsers of HTML, checks that block often, skills that need hand-holding each run.
- Skills that overwrite the user's own writing in RESULT.md without asking.
- Drill questions that test trivia about this repo instead of what the exam tests (`docs/exam-guide.md` task statements, section 9 sample-question style).
- A Stop hook that blocks repeatedly or runs anything costly.

## Dropped for good (user approved)

| Item | Reason |
|---|---|
| `exercise-folder-naming` hook (P3) | `/new-exercise` already scaffolds the right folder name; the hook would only catch folders made by hand, which does not happen in this workflow. |
| `exercise-review` skill + `exercise-reviewer` agent (P2) | Overlaps built-in `/code-review`, `/simplify` and the fresh-reader review step inside `/build-exercise`. |
| `progress` as a separate skill | Folded into the `curriculum-status` SessionStart hook (goal 7): shows up every session with no command to remember. |

## Constraints (from the repo)

- Hooks: plain Node.js `.mjs`, no dependencies, in `.claude/hooks/`, shared code in `.claude/hooks/lib/`, tests in `.claude/hooks/*.test.mjs`, run by root `npm test`. Hook timeout is 10 s.
- Skills: `.claude/skills/<name>/SKILL.md` with frontmatter (`name`, `description`, `argument-hint`, `disable-model-invocation` where the skill spends money or writes many files). Match the voice and structure of the existing skills (`run-exercise`, `log-analysis`, `build-exercise`): numbered steps, explicit stop conditions, a "done when" sentence.
- Agents: `.claude/agents/<name>.md`.
- HTML pages: the rules in `CLAUDE.md` → "HTML write-ups, per exercise" are the spec for both pages (sections, header, self-contained, light/dark, phone width, Mermaid from a pinned `cdn.jsdelivr.net/npm/mermaid@<x.y.z>`, nothing else external, committed to git).
- Commits: harness commits use `feat(harness): …` / `docs(harness): …` (existing history). No Claude attribution (user global rule).
- The builder should load `superpowers:writing-skills` (or `writing-for-agents`) before writing SKILL.md / agent files.

## Design, item by item

### 1. `log-analyst`: optional `Call samples`

Add a ninth heading, `## Call samples`, returned **only when the caller asks for it**. The eight existing headings and their order stay unchanged, so `log-analysis` and `run-exercise` keep checking eight.

Content, per distinct kind of call (first turn, tool-use turn, subagent call, final turn — whichever the run has): the logged request fields (model, system, messages, tools, params such as `max_tokens`) and the logged response (content blocks, `stop_reason`, `usage`), verbatim, each with its log line numbers. Long strings (a quoted line can be 40,000 chars) are cut to their first ~500 chars plus `… <N> more chars, L<n>` so the report stays small; the cut is always marked.

The agent also states, per sample, which request/response fields the log does **not** record (feeds the "Limits" section of the data-flow page).

Two log formats exist and both must work (*my call*: the anti-goal "skills that need hand-holding" rules out a Messages-API-only skill, and most coming lessons, 1.2 and 1.4–1.7, are Agent SDK runs like 1.3):

- **Messages API runs** (1.1): `===== iteration N request (messages.create) =====` records hold model, messages and tools as complete JSON; responses are logged in full. Samples are near-verbatim.
- **Agent SDK runs** (1.3): `===== stream[N] type=… =====` records, `── Agent call ▶` blocks with subagent prompts, totals in the final `type=result` record. There is no request body: the system prompt, tools array and params are mostly absent. Samples take what the stream shows (assistant `message` with `id`, `model`, `content`, `usage`; the init record's `tools`/`agents`/`model`; subagent prompts) and list every request field that is missing, instead of inventing it.

### 2. `/gist <id>`

Input: task ID. Reads `src/` itself (exercise sources are small) and the README `## What it builds` acceptance behaviours. Writes `<folder>/Gist_<id>.html` per `CLAUDE.md` → `Gist_<task-id>.html`:

1. Header: task ID, lesson title linked to the lesson URL (from `docs/curriculum.md`), one-line summary, links to `README.md`, `RESULT.md`, `Log_data_flow_<id>.html`.
2. Mermaid flowchart of the program flow, nodes named after files and functions in `src/`, plumbing (`.env`, logging) left out.
3. Important steps in program-flow order: short source excerpt, `file:line`, what it does, why (in lesson terms).

Self-check before finishing: every acceptance behaviour maps to at least one step (the skill prints the behaviour → step map in chat); every `file:line` cited exists and the excerpt matches that line. Needs no run, so it can run right after `/build-exercise`. If the page exists, ask before overwriting.

### 3. `/data-flow <id> [log path]`

Log selection: explicit path if given; else the log RESULT.md section 1 names (1.1's RESULT has `- Log: \`Log/20261021-010626_run.log\``); else the newest `Log/*.log`. Stop if none exists. Says which log it chose and why.

Dispatches `log-analyst` with the log path, the acceptance behaviours, and the request for `Call samples`. Checks all nine headings; re-dispatches once for missing ones (same pattern as `log-analysis`). Writes `<folder>/Log_data_flow_<id>.html` per `CLAUDE.md` → `Log_data_flow_<task-id>.html`:

1. The run: log file name, date, command, model, totals (calls, tokens, cost, duration).
2. Mermaid `sequenceDiagram` of every model and tool call in order, participants named after the lesson's roles.
3. Call table: number, role, model, input/output tokens, duration, stop reason.
4. Reconstructed `POST /v1/messages` request/response JSON, at least one pair per distinct call kind, each marked *reconstructed* and citing the log lines its values come from.
5. Limits: what the log does not show.

For an Agent SDK log, a field the log does not hold appears in the reconstructed JSON as `"<not in log>"` and is listed under Limits; the page never fills it from memory or from `src/`.

Self-check: call count and tokens on the page equal RESULT.md section 2 when RESULT cites the same log; a mismatch is reported to the user, not silently fixed. Cost: from the log's `result` record when there is one (SDK), else from RESULT section 2 (1.1's Messages API log holds no USD), and the page says which. If the page exists, ask before overwriting.

Section 4 backfill (*my call*): `data-flow` already holds the log-analyst `Acceptance evidence`. When RESULT `## 4. Acceptance behaviours` is empty, it offers to draft it from that evidence (one line per behaviour: verdict + log line), with no paid rerun. This is how 1.1 gets its section 4.

### Shared page shell

Both pages share one HTML shell (inline CSS tokens for light/dark, phone-width layout, header block, pinned Mermaid script, Mermaid theme switched with the colour scheme) so they look like one set. One shell file that both skills read; location is the builder's call (e.g. `.claude/skills/gist/page-shell.html`, referenced from `data-flow`). Pick one current Mermaid 11.x version and pin it in that one place.

### 4. `exercise-completeness`: require both pages

`completenessProblems()` in `.claude/hooks/lib/exercise.mjs` also reports `Gist_<id>.html is missing` and `Log_data_flow_<id>.html is missing`.

It also reports **empty RESULT sections** (*my call*): a required RESULT heading followed by no non-blank, non-comment line before the next H2 → `RESULT.md: section "<name>" is empty`. Reason: headings-only would let `progress` call a half-written exercise "looks done". It does not raise how often the Stop hook blocks (a fresh scaffold already fails on the missing pages; it still blocks once per turn), it only makes the list accurate. README sections stay headings-only (the scaffold fills them). Exemption list: `["1.3"]` as a named constant with a comment pointing at `CLAUDE.md` ("Exercise 1.3 predates these pages"). Existence check only; the hook does not parse HTML (anti-goal: brittle). Tests added to `.claude/hooks/exercise.test.mjs`: missing pages reported, present pages pass, 1.3 exempt.

Accepted side effect: during a `/build-exercise` session the Stop hook will list the missing pages once. That is the hook working as designed (blocks once, honours `stop_hook_active`).

### 5. `/study-notes <id>`

Runs in the main context. Dispatches `lesson-researcher` (sonnet, medium) for concepts, neighbouring tasks and Anthropic doc links; reads the task's `Task Statement` in `docs/exam-guide.md` and RESULT sections 1–4 itself.

Writes RESULT `## 5. Study points` and `## 6. Open questions and next tries` (headings kept word for word):

- Study points: what the exam tests for this task (from the task statement), plus what this run taught that the lesson did not say, plus "pick this over that" contrasts with neighbouring tasks.
- Open questions: things to try next with this exercise.

Ownership rule (*my call*, consistent with `run-exercise` saying sections 4–6 belong to the user): the skill **shows the draft in chat and asks** (approve / change / stop) before writing. If sections 5–6 already have content, it never replaces them unasked: it offers keep (drills only), replace, or append.

Drill bank: appends five questions to `docs/drills/<id>.md` (new folder; add `docs/drills/` to the `CLAUDE.md` layout block). Question format (*my call*, matches the exam's 4-option multiple choice):

```markdown
### Q<n>. <short title>
<scenario-style stem, as in exam-guide section 9>

- A. …
- B. …
- C. …
- D. …

**Answer:** B
**Why:** <one or two sentences; why the distractors are wrong>
**Source:** <exam-guide task statement line / RESULT study point / lesson>
```

Questions test the exam's task statement, not repo trivia (anti-goal). Numbering continues from the last `Q<n>` in the file; re-running adds five more, never rewrites existing ones.

### 6. `/drill [id | domain]`

Input: a task ID (`1.3`), a domain number (`1`), or nothing (all). Pool: questions in `docs/drills/` for that scope. Asks one question at a time with **AskUserQuestion** (four options A–D map to its 2–4 option limit), option order shuffled, answer not shown before the user picks. After each: right/wrong plus the **Why** line. Default 5 questions per session; a number in the arguments overrides it.

When the pool has fewer questions than asked for, it generates extra ones from the scope's RESULT study points, in the same format, and says they are unsaved.

Weak spots (*my call*): at the end it prints the score and the task IDs missed, and appends one line per session to `docs/drills/history.md` (`<date> | <scope> | <score> | missed: <id>#Q<n>, …`). The next session picks previously missed questions first. History is committed with the drills; it is small and is the user's study record.

### 7. `progress` folded into `curriculum-status`

Same hook, new section after the existing counts. Report only; never edits `docs/curriculum.md`.

- Domain-weighted completion: the weights from the `## Domain N: … (NN%)` headings in `docs/curriculum.md` (parsed, not hard-coded), `Σ weight × done_in_domain / tasks_in_domain`. "Done" comes from the status column. One line, e.g. `Weighted progress: 3.9% (D1 1/7, D2 0/6, …)` (1.3 done, D1 = 27%).
- Mismatches, one line each, only when there are any:
  - status `done` but `completenessProblems()` reports problems → list them (short),
  - status `todo` but the folder exists,
  - status `in progress`/`done` but the row has no folder or the folder is missing,
  - status `in progress` but `completenessProblems()` is empty → "looks done".
- Does not look at `Log/` (gitignored; a fresh clone would look unfinished).

Must stay within the 10 s timeout and keep the existing "each half fails on its own" pattern so a crash here never hides the API key warning. Tests in `hooks.test.mjs` / `exercise.test.mjs` with the existing fixtures.

### Gap fixes (*my calls*, small, found while reading the loop)

- **RESULT section 4 has no owner.** `run-exercise` fills 1–3, `study-notes` fills 5–6, nobody fills `## 4. Acceptance behaviours`. `run-exercise` already has the log-analyst `Acceptance evidence`, so it also drafts section 4 (one line per behaviour: verdict + log line) under the same "write only when empty, else ask" rule as 1–3.
- `run-exercise` step 6 says `/study-notes` is "planned but not built": change to point at `/study-notes`, and suggest `/data-flow` (and `/gist` if the page is missing).
- `build-exercise` ends by suggesting `/gist`.

### 9. Docs

- `docs/agent-harness-todo.md`: header note "Frozen on <date>"; every built item marked built; the dropped table above with reasons; build-order steps 6–7 struck through.
- `CLAUDE.md`: layout block gains `docs/drills/`.
- Root `README.md` → "Claude Code harness": add `/gist`, `/data-flow`, `/study-notes`, `/drill`, the progress lines in the session-start note.

## Validation (definition of done for this project)

1. `npm test` passes at the repo root, with new tests for goals 4 and 7.
2. `/gist 1.1` produces `Agent_Orc/1.1_agentic_loops/Gist_1.1.html`; it renders (Mermaid draws, light and dark, phone width) and every acceptance behaviour maps to a step.
3. `/data-flow 1.1` produces `Log_data_flow_1.1.html` from `Log/20261021-010626_run.log`; totals match 1.1 RESULT section 2; it offers and (on approval) fills 1.1's empty section 4. A second dry run on the newest 1.3 log (Agent SDK format) writes its page to the session scratchpad, not the repo (1.3 is exempt), to prove the SDK branch; missing request fields show as `"<not in log>"` and under Limits.
4. `/study-notes 1.1` fills 1.1 sections 5–6 (after user approval) and writes `docs/drills/1.1.md`. `/study-notes 1.3` keeps 1.3's existing sections and writes `docs/drills/1.3.md`.
5. `/drill 1` runs a 5-question session from those two files and writes one `history.md` line.
6. A fresh session start shows the weighted progress line and any mismatches. Expected after steps 2–4: no mismatch for 1.3; 1.1 reported "in progress … looks done", which is accurate, since the user sets `done` after reading the write-ups.
7. Docs updated as in section 9.

Rendering check: open each page in a browser (the `chrome-devtools-axi` CLI or Claude in Chrome), both colour schemes and a ~390 px width.

## Left to the builder

- File layout inside each skill folder (extra reference files, templates).
- Exact Mermaid 11.x version, CSS, and the shell's look, within the `CLAUDE.md` rules.
- Wording of skill steps, as long as they match the existing skills' voice.
- Commit granularity within the `feat(harness)` / `docs(harness)` convention.
- Whether the progress code goes in `lib/status.mjs` or a new `lib/progress.mjs`.
- Which new skills get `disable-model-invocation`. (Plan decision: none of the four. `disable-model-invocation` stays reserved for skills that spend money, like `run-exercise`; the new ones ask before overwriting, and validation needs Claude to invoke them.)
- Whether 1.1's validation outputs go in `docs(1.1)` commits, separate from the `feat(harness)` ones.
