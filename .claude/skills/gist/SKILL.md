---
name: gist
description: Write Gist_<id>.html, the code walkthrough of an exercise's src/ with a Mermaid program-flow diagram and file:line excerpts. Use it after /build-exercise or when asked for an exercise's gist or code walkthrough. It needs no run.
argument-hint: <task-id>
---

Write the gist page for exercise **$ARGUMENTS**: the code view of how the program implements the lesson. A reader opens it to see the flow at a glance, then each important step with its source and the lesson reason it is there. It is written from `src/` alone, so it can come before the paid run.

## 1. Check the exercise

Find the `$ARGUMENTS` row in `docs/curriculum.md`: its title, lesson URL and folder. Stop and tell the user if:

- the row has no folder, or the folder has no `src/`,
- `src/` still holds only the scaffold (`src/index.ts` with its `TODO($ARGUMENTS)` line): run `/build-exercise $ARGUMENTS` first,
- the README's `## What it builds` section has no numbered behaviours.

If `<folder>/Gist_$ARGUMENTS.html` already exists, ask the user with AskUserQuestion: overwrite, or stop.

## 2. Read the sources

- `CLAUDE.md`, sections "HTML write-ups, per exercise" and "Gist_<task-id>.html": the page's rules.
- The README: the acceptance behaviours, numbered as written there.
- Every file in `src/`, in full. Read `index.ts` first and follow the calls, so you know the program flow before you draw it.
- `.claude/skills/gist/page-shell.html`: the shell the page is built in. Its top comment lists the placeholders and building blocks.

## 3. Plan the steps

List the important steps in program-flow order. A step is one place in the code where the lesson concept happens: a model call, a tool call, a loop decision, a check that fails loudly. Plumbing (`.env` reading, logging, argument parsing) is not a step.

Map every acceptance behaviour to at least one step. A behaviour with no step means a step is missing: find the code that produces it and add the step.

## 4. Write the page

Fill the shell and write `<folder>/Gist_$ARGUMENTS.html`:

- **Header**: `{{TASK_ID}}`, lesson title and URL from the curriculum row, a one-line summary of what the program shows, and `{{NAV}}` links to `README.md`, `RESULT.md` and `Log_data_flow_$ARGUMENTS.html`.
- **Section 1, Program flow**: one Mermaid `flowchart TD`. Nodes are named after the files and functions in `src/` (`agent-loop.ts runLoop()`); edges show model calls, tool calls and checks. Draw the lesson concept and leave plumbing out.
- **Section 2, Important steps**: one `.step` block per planned step, in flow order. Each has a heading, its `file:line` (`src/agent-loop.ts:42`), a short excerpt (about 3 to 15 lines, HTML-escaped), what the code does, and why it is there in lesson terms. Name the acceptance behaviours the step produces.

## 5. Check

- Re-read each cited `file:line` and confirm the excerpt matches the source there. Fix any drift.
- Confirm every acceptance behaviour appears in at least one step.

## 6. Report

Show the user the behaviour → step map as a table, and the page path. If the folder has no `Log/` run yet, the next step is `/run-exercise $ARGUMENTS`; otherwise suggest `/data-flow $ARGUMENTS`.

Done when the page exists, every behaviour maps to a step, and every excerpt matches its line.
