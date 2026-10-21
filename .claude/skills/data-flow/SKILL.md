---
name: data-flow
description: Write Log_data_flow_<id>.html, the wire view of one exercise run built from its log - sequence diagram, call table and reconstructed Messages API request/response pairs. Use it after /run-exercise or when asked what travelled between program, model and tools in a run. Takes a task ID and optionally a log path.
argument-hint: <task-id> [log path]
---

Write the data-flow page for **$ARGUMENTS**. The first word is the task ID; a second, if given, is the log path. The page shows what actually travelled between the program, the model and the tools in one run. Every number and every JSON value on it comes from the log, through the **log-analyst** agent; the log stays out of this context.

## 1. Find the exercise

Find the task's row in `docs/curriculum.md`: its title, lesson URL and folder. Stop if the row has no folder.

## 2. Choose the log

Take the first that applies, and tell the user which log you chose and why:

1. The log path given as the second argument.
2. The log that RESULT.md section `## 1. Run` names (a line such as ``- Log: `Log/20261021-010626_run.log` ``). RESULT.md's cost and trace come from that run, so the page matches them. If the named file does not exist (logs are gitignored, so a fresh clone has none), say so and ask the user with AskUserQuestion: use the newest log in `Log/` instead, or stop. A fallback log is a **different run** from the one RESULT.md describes: steps 5, 6 and 7 then take nothing from RESULT.md, and the page's header summary says it shows a different run from RESULT.md.
3. The newest `*.log` in `<folder>/Log/` by modification time.

Stop if no log exists: the next step is `/run-exercise <id>`.

## 3. Dispatch the log-analyst

Give the agent the log path, the acceptance behaviours from the README's `## What it builds` section (numbered as there), and the line: "Also return `## Call samples`." Its report has nine headings: `Run`, `Timeline`, `Prompts sent`, `Tool calls`, `Handoffs`, `Tokens and cost`, `Anomalies`, `Acceptance evidence`, `Call samples`. If any is missing, dispatch it once more with its previous report and the names of the missing headings.

## 4. Check for an existing page

If `<folder>/Log_data_flow_<id>.html` exists, ask the user with AskUserQuestion: overwrite, or stop.

## 5. Write the page

Read `CLAUDE.md`, sections "HTML write-ups, per exercise" and "Log_data_flow_<task-id>.html", then fill `.claude/skills/gist/page-shell.html` (its top comment lists the placeholders and building blocks). Header: task ID, lesson title and URL, a one-line summary of the run, and `NAV` links to `README.md`, `RESULT.md` and `Gist_<id>.html`. Then five sections, all from the agent's report:

1. **The run**: log file name, date, command, model, and totals for calls, input/output tokens, cost and duration. Cost comes from the log's `result` record when there is one (Agent SDK runs); otherwise from RESULT.md section 2 when RESULT.md cites this same log; otherwise it reads "not in log (Messages API responses report tokens, not USD)". Say which.
2. **Sequence**: one Mermaid `sequenceDiagram` with every model call and tool call in order. Participants are the lesson's roles (coordinator, subagent, tool, API), not file names.
3. **Call table**: number, role, model, input/output tokens, duration, stop reason.
4. **Requests and responses**: at least one pair per distinct kind of call in `Call samples` (first turn, tool-use turn, subagent, final turn), shaped as `POST /v1/messages` JSON. Mark each one with a `reconstructed` tag and cite the log lines its values come from. Every value comes from the samples: a gap is marked, never filled from memory or from `src/`. How a gap is marked depends on the log's shape. A Messages API request record is the complete body the program sent, so a field absent there (such as `system`) was not sent: leave it out of the JSON. An Agent SDK log has no request body, so a field it does not hold appears as `"<not in log>"`.
5. **Limits**: what the log does not show, from the samples' `Not in log:` lists and the agent's Anomalies.

## 6. Check

When RESULT.md cites this same log, the page's call count and token totals equal those in RESULT.md section 2. Report a mismatch to the user with both numbers. Leave the page as the log says and RESULT.md as it is. With a fallback log (step 2), skip this check and tell the user it was skipped because the page shows a different run.

## 7. Fill an empty section 4

Only when RESULT.md cites this same log, so that section 4 quotes the run sections 1 to 3 describe. If RESULT.md `## 4. Acceptance behaviours` has no content, draft it from the agent's `Acceptance evidence`: one line per behaviour with its verdict (SHOWN / NOT SHOWN / PARTLY) and log line. Show the draft and ask the user with AskUserQuestion: write it, or leave the section empty. Keep the heading word for word.

## 8. Report

Show the user the page path, the run totals, the result of the step 6 check, and whether section 4 was filled. If `Gist_<id>.html` is missing, suggest `/gist <id>`; once RESULT sections 5 and 6 are empty, suggest `/study-notes <id>`.

Done when the page exists, its totals match RESULT.md or the mismatch is reported, and every reconstructed body cites its log lines.
