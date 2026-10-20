---
name: log-analysis
description: Analyse an exercise run log (Log/*.log) through the log-analyst agent. Use it when asked what a run did, what it cost, which prompts or tool calls it made, why it failed, or whether it shows the acceptance behaviours. It takes a log path or a task ID.
argument-hint: <log path | task-id>
---

Analyse the run log named by **$ARGUMENTS**. The log stays out of this context: the **log-analyst** agent reads it, and you render its report.

## 1. Find the log

- **A path**: use it.
- **A task ID** (such as `1.3`): find the row in `docs/curriculum.md`, take its folder, and use the newest `*.log` in `<folder>/Log/` by modification time.
- **No argument**: ask the user for a log path or a task ID.

Stop and say so if the file does not exist or the folder has no logs.

## 2. Collect the acceptance behaviours

Read the `## What it builds` section of `<folder>/README.md`. Each behaviour there is one step with its observable result. If there is no README or no section, send the agent no behaviours.

## 3. Dispatch the log-analyst

Give the agent the log path and the acceptance behaviours, numbered as in the README. Its report has eight headings: `Run`, `Timeline`, `Prompts sent`, `Tool calls`, `Handoffs`, `Tokens and cost`, `Anomalies`, `Acceptance evidence`.

Check that all eight are present. If any is missing, dispatch the agent again with its previous report and the names of the missing headings.

## 4. Render

Show the user, in chat:

1. One summary line: outcome, duration, total cost, and model calls.
2. The `Tokens and cost` table.
3. The `Acceptance evidence` lines as a table: behaviour, verdict, evidence line.
4. The `Anomalies`, if there are any.
5. The `Timeline`, condensed to the 10 most important events.

Keep the line numbers on the quotes, so the user can open the log at that spot. The full agent report is the source for RESULT.md: give it in full only when the user asks for it.
