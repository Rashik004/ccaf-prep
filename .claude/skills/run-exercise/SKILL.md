---
name: run-exercise
description: Run one exercise with npm start, analyse its log, fill in RESULT.md sections 1 to 3 from the log, and report which acceptance behaviours showed up. Each run calls the Anthropic API and costs money.
argument-hint: <task-id> [program arguments]
disable-model-invocation: true
---

Run the exercise for **$ARGUMENTS**. The first word is the task ID. The rest, if any, is passed to the program. Typing this command is the user's approval to spend money on one run. A retry is a second run and needs the user's approval again.

## 1. Find the exercise

Take the folder from the task's row in `docs/curriculum.md`. Stop if the row has no folder or the folder has no `package.json`. If no program arguments were given, use the example prompt in the README's `## Run` section. If the README has none, start with no arguments.

## 2. Run

In the folder:

1. Run `npm install` if `node_modules/` is missing.
2. Run `npm run typecheck` if the package has that script. Fix any type errors before you spend money on a run.
3. Run `npm start -- <arguments>`. Quote the arguments as one string. Exercise runs often take 5 to 15 minutes, so run the command in the background and wait for it to finish. Polling the output is not waiting.

The run is finished when the process has exited. Record the exit code, the command line exactly as you ran it, and the date.

## 3. Analyse

Take the newest `*.log` in `<folder>/Log/`. Make sure that it was written by this run: its banner `started:` time is after you started the run.

Dispatch the **log-analyst** agent with the log path and the acceptance behaviours from the README's `## What it builds` section. Make sure that its report has all eight headings.

## 4. Fill in RESULT.md sections 1 to 3

Edit only these three sections of `<folder>/RESULT.md`, and keep their headings word for word. Every fact comes from the log-analyst report. Quote the log; do not paraphrase it.

- **`## 1. Run`**: the command, the date, the exit code and the log file name.
- **`## 2. Cost`**: the model or models, the number of model calls, the input and output tokens, and the total in USD. When there is more than one call, add a per-call table (for example, coordinator vs subagents, or retries).
- **`## 3. What happened`**: a condensed trace in run order. Use quoted log excerpts for the prompts, the decisions, the handoffs and the tool calls.

If the run failed, still fill sections 1 to 3 with what the log shows, and mark section 1 `FAILED: <the ■ line>`.

Leave sections 4 to 6 for the user and for `/study-notes`. Also leave the README's cost line for the user.

## 5. Report

Show the user:

- the outcome and the total cost,
- one line per acceptance behaviour: SHOWN / NOT SHOWN / PARTLY, with the log line,
- the anomalies the agent found,
- what is still open for "done" in `CLAUDE.md`: RESULT.md sections 4 to 6, the README cost line, and the curriculum status.
