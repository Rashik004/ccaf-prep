---
name: run-exercise
description: Run one exercise with npm start, analyse its log, fill in RESULT.md sections 1 to 4 from the log, and report which acceptance behaviours showed up. Each run calls the Anthropic API and costs money.
argument-hint: <task-id> [program arguments]
---

Run the exercise for **$ARGUMENTS**. The first word is the task ID. The rest, if any, is the program's arguments. Typing this command is the user's approval to spend money on **one** run. A retry is a second run and needs the user's approval again.

## 1. Find the exercise

Take the folder from the task's row in `docs/curriculum.md`. Stop if the row has no folder or the folder has no `package.json`.

Program arguments: pass the ones the user typed, as typed. If there are none, take the `npm start -- …` line from the README's `## Run` section. If that line still holds a template placeholder (`{{…}}` or `<example prompt>`), or there is no such line, stop and ask the user for the prompt. A run on a placeholder prompt wastes money.

## 2. Run

In the folder:

1. Run `npm install` if `node_modules/` is missing.
2. Run `npm run typecheck` if the package has that script. If it fails, stop and show the errors. This skill runs the code; it does not change it.
3. Note the time, then run `npm start -- <arguments>`. Exercise runs often take 5 to 15 minutes, so run the command in the background and wait for the completion notice. Polling the output is not waiting.

The run is finished when the process has exited. Record the exit code, the command line exactly as you ran it, and the date.

## 3. Find this run's log

Take the newest `*.log` in `<folder>/Log/` by modification time. It belongs to this run only if it was modified after the time you noted in step 2. If no log qualifies, stop: report that the run wrote no log, show the run's stderr tail, and leave RESULT.md as it is.

## 4. Analyse

Dispatch the **log-analyst** agent with the log path and the acceptance behaviours from the README's `## What it builds` section. Its report must have all eight headings (`Run`, `Timeline`, `Prompts sent`, `Tool calls`, `Handoffs`, `Tokens and cost`, `Anomalies`, `Acceptance evidence`). If a heading is missing, dispatch the agent again with its previous report and the names of the missing headings.

## 5. Fill in RESULT.md sections 1 to 4

Draft the four sections from the log-analyst report. Every fact comes from that report. Quote the log; do not paraphrase it.

- **`## 1. Run`**: the command, the date, the exit code and the log file name. If the run failed, start with `FAILED: <the ■ line>`.
- **`## 2. Cost`**: the model or models, the number of model calls, the input and output tokens, and the total in USD. When there is more than one call, add a per-call table (for example, coordinator vs subagents, or retries).
- **`## 3. What happened`**: a condensed trace in run order. Use quoted log excerpts for the prompts, the decisions, the handoffs and the tool calls.
- **`## 4. Acceptance behaviours`**: one line per behaviour from the agent's `Acceptance evidence`: the behaviour, its verdict (SHOWN / NOT SHOWN / PARTLY) and the log line.

Write the draft into RESULT.md under those four headings, keeping each heading word for word, only when all four sections are empty and the task is not `done`. Otherwise the sections hold a write-up someone already made from another run: show the user the draft and ask whether to replace them, keep them, or add this run below them as `### Run <date>`. Sections 5 and 6 belong to the user (`/study-notes` drafts them with the user's approval); leave them as they are.

## 6. Report

Show the user:

- the outcome and the total cost,
- one line per acceptance behaviour: SHOWN / NOT SHOWN / PARTLY, with the log line,
- the anomalies the agent found,
- what is still open for "done" in `CLAUDE.md`, with the command for each: `/data-flow <id>` for `Log_data_flow_<id>.html`, `/gist <id>` if `Gist_<id>.html` is missing, `/study-notes <id>` for RESULT.md sections 5 and 6, then the README's cost line and the curriculum status.
