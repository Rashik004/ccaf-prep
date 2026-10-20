---
name: build-exercise
description: Write the src/ code for a scaffolded exercise, from the acceptance behaviours in its README. Asks when the spec is unclear, uses subagents for larger exercises, and stops before any paid run.
argument-hint: <task-id, e.g. 1.1>
disable-model-invocation: true
---

Write the code for exercise **$ARGUMENTS**. The code is the study aid: a reader who has not seen the lesson opens `src/`, reads it top to bottom once, and understands the lesson's concept from it. Every choice below serves that reader. This skill covers steps 3 and 5 of "Starting a new exercise" in `CLAUDE.md` up to the first run. It never runs `npm start`: a run costs money and belongs to `/run-exercise`.

## 1. Check the exercise

Find the `$ARGUMENTS` row in `docs/curriculum.md` and open its folder. Stop and tell the user if:

- the status is not `in progress` (run `/new-exercise $ARGUMENTS` first),
- the folder has no `package.json` or no `README.md`, or
- the README's `## What it builds` section has no numbered behaviours.

If `src/` already holds code beyond the scaffold (`src/index.ts` without its `TODO($ARGUMENTS)` line, or more files than `index.ts` and `log.ts`), ask the user whether to extend that code, replace it, or stop. Never overwrite it unasked.

## 2. Gather the spec

Read these yourself. The design decisions are yours, so the sources stay in your context:

- the README: the acceptance behaviours, the example prompt and the test inputs,
- `CLAUDE.md`, sections **Code rules** and **Logging rules**,
- `common/log.ts` (the `RunLog` API that every model and tool call goes through) and `common/env.ts`,
- `Agent_Orc/1.3_subagent_invocation/src/`: a finished exercise that shows the house style.

You also need the lesson-researcher brief from `/new-exercise`: its Build Exercise quote and its Anthropic doc links give the exact tools, schemas and API calls the steps name. Use it if it is still in this conversation. If it is not, dispatch the **lesson-researcher** agent with `model: "sonnet"` and `effort: "medium"`. Fetch the doc pages for the API features you will call, so the code uses the current SDK names, not remembered ones.

## 3. Resolve what is unclear

Before you design anything, list every point where the spec allows more than one program:

- the SDK or API (Messages API vs Agent SDK), when the Build Exercise does not say,
- a tool's name, input schema or output shape, when the lesson only describes it,
- sample data or mock responses the lesson leaves open,
- a behaviour you cannot make observable in the log,
- a behaviour that conflicts with another, or with a `CLAUDE.md` rule.

Settle each point one of two ways. If `CLAUDE.md`'s rule ("take the smallest option that satisfies it") gives one clear answer, take it and note it for the plan. If the answer changes what the program teaches or what the run will show, ask the user with **AskUserQuestion**: up to 4 questions per call, each with 2 to 4 concrete options, your recommendation first. Do not guess on those. This step is done when no open point is left.

Then compare the SDK decision with `package.json`. If the SDK it names is not installed, run `npm install <sdk>` in the folder.

## 4. Plan

Write the plan and show it to the user:

1. **Files**: one row per file in `src/`: the name (after the role it plays in the lesson, such as `agent-loop.ts` or `tools.ts`), its one job, and what it exports, with TypeScript signatures.
2. **Behaviour map**: one row per acceptance behaviour: the file that produces it, the log line that shows it, and the check (an assertion that fails loudly) where the behaviour is a rule.
3. **Decisions**: each point from step 3 and how it was settled.

Keep `index.ts` as the entry point: it reads the arguments, makes one call into the file that runs the lesson's flow, and prints the result. Keep `log.ts` for this lesson's trace events. Keep each file short enough to read in one sitting, about 150 lines at most. Split a file that does two jobs, and merge two files that are only meaningful together.

Ask the user to approve or correct the plan with AskUserQuestion (options: approve, change it, stop). Apply every correction before you write code.

## 5. Write the code

Write the shared contract first, yourself: `src/types.ts`, plus the trace-event functions in `src/log.ts`. Every other file builds on them, so their names and shapes must be fixed before anyone writes against them.

Then choose who writes each remaining file:

| Situation | Writer |
|---|---|
| 4 or fewer files to write, or the files depend on each other line by line | You, in this session |
| More files, in independent groups | Subagents, one per group, dispatched in one message so they run in parallel |

Give each subagent the brief from [`writer-brief.md`](writer-brief.md), filled in for its files. Spawn it as a `general-purpose` agent with the model and effort that fit its files. When a group mixes kinds, use the row of its heaviest file:

| File kind | Examples | `model` | `effort` |
|---|---|---|---|
| The lesson's core mechanism | the agent loop, the coordinator, the enforcement gate, the verifier | `opus` | `high` |
| Supporting code | tool implementations, prompt builders, parsers, report writers | `sonnet` | `medium` |
| Data and fixtures | sample documents, mock tool results, test inputs | `haiku` | `low` |

When a subagent returns a `QUESTION:`, put it to the user with AskUserQuestion. Then dispatch a new writer with the same model and effort, and the full brief with the answer added under "Decisions already made". When a subagent reports a choice the brief did not settle, check it against the plan, and correct the file if it conflicts.

Write `index.ts` last, yourself, once every file it calls exists.

## 6. Check

Run these in the exercise folder and fix what they find. This step is done when all of them pass.

1. `npm run typecheck` exits 0.
2. `src/` contains no `TODO(` line: the scaffold's placeholder is gone.
3. Every row of the behaviour map is in the code: its log line is written with the shared logger, and its check throws an error whose message names the behaviour.
4. Every model call and every tool call is recorded in full: `log.record()` for a request and its response (with usage and duration), or `log.stream()` for each message of a streamed Agent SDK session.
5. stdout carries the program's result only. Everything else goes to the log or stderr.
6. **Readability review**: dispatch a `general-purpose` agent with `model: "sonnet"` and `effort: "medium"`. Give it the paths of the files in `src/` and these rules: read only those files (not the README, the lesson or `CLAUDE.md`), edit nothing, run nothing. Ask it to explain, for each file in two sentences, what the file does and which concept it shows. Then ask it to list every line where a learner would stop and reread, with the reason.
   - Fix every place where its explanation does not match the plan.
   - Fix each stumbling point that holds up. Keep the lesson's own terms (`stop_reason`, `tool_use`, handback) even when the reviewer finds them unfamiliar: they are what the learner is there to learn. Explain them in a comment instead.
   - After the fixes, run the review once more. Fix what holds up, and then stop reviewing.

## 7. Hand over

Update the README's `## Source files` table: one row per file in `src/`, with the role it plays. Then show the user:

- the files and their roles,
- the behaviour map: each behaviour, its log line, and its check,
- the decisions from step 3,
- the next steps: `/gist $ARGUMENTS`, which needs no run, then `/run-exercise $ARGUMENTS`, which costs money for one run.
