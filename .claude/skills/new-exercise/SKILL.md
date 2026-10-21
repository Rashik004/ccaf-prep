---
name: new-exercise
description: Start the exercise for one curriculum task ID. Researches the lesson, agrees the acceptance behaviours with you, then scaffolds the folder and marks the task in progress.
argument-hint: <task-id, e.g. 1.1>
---

Start the exercise for task **$ARGUMENTS**. This skill covers steps 1 to 4 of "Starting a new exercise" in `CLAUDE.md`: research, acceptance behaviours, scaffold, status. The user approves the acceptance behaviours before anything is written to the repo. The code is written after the scaffold.

## 1. Check the task

Find the `$ARGUMENTS` row in `docs/curriculum.md`. The row gives the title, the lesson URL, the folder and the status. Stop and tell the user if:

- there is no row,
- the status is `done`, or
- the exercise folder (step 5 says how it is named) already exists and holds anything besides `Log/`, `output/` and `node_modules/`. Existing files are someone's work: this skill writes only new folders.

## 2. Research the lesson

Dispatch the **lesson-researcher** agent with the task ID. Its brief has the headings `Concepts`, `Acceptance behaviours`, `Suggested scenario`, `Anthropic doc links` and `Neighbouring tasks`. Under `Acceptance behaviours` the brief must also give the Build Exercise text in a quote block. If the quote block is missing, dispatch the agent again with its previous brief and ask for the quote block.

If `Acceptance behaviours` says `NO BUILD EXERCISE FOUND`, stop. Show the user what the agent tried, and ask how to go on.

Read the `#### Task Statement $ARGUMENTS:` section of `docs/exam-guide.md` yourself. It tells you what the exam tests, and step 3 uses it.

## 3. Write the acceptance behaviours

Go through the brief's list against its Build Exercise quote. You need exactly one behaviour per step, and each behaviour must name what the program's output or log shows. A behaviour that describes code ("a constant exists") is not finished: rewrite it as a log line or stdout content. Where the task statement names a skill the steps also exercise, make the behaviour show it. The list is finished when you could check each line against a run log with grep.

Take the example prompt and test inputs from the brief's `Suggested scenario`.

## 4. Agree them with the user

Show the user:

- the numbered acceptance behaviours,
- the example prompt and test inputs, marked "proposed" where the lesson gave none,
- the folder name you will use (step 5).

Ask the user to approve or correct them. Apply every correction, and show the list again until the user approves it. Steps 5 and 6 write the approved version.

## 5. Scaffold the folder

Folder: `<domain folder>/<id>_<short_snake_title>/`.

- The domain folder comes from the curriculum section: `Agent_Orc` 1, `Tool_MCP` 2, `CC_Config` 3, `Prompt_Eng` 4, `Context_Mgmt` 5.
- The short title is the curriculum title shortened to its 2 to 4 key words, in snake_case. For example, "Agentic Loops" becomes `agentic_loops`, and "CLAUDE.md Hierarchy, Scoping, and Modular Organisation" becomes `claude_md_hierarchy`.
- If the curriculum row already has a folder, use that folder.

Copy every file from [`templates/`](templates/) into the folder, keeping the paths. Then replace the placeholders:

| Placeholder | In | Value |
|---|---|---|
| `{{ID}}` | all files | task ID, e.g. `1.1` |
| `{{TITLE}}` | package.json, README, RESULT | lesson title from the curriculum row |
| `{{LESSON_URL}}` | README | lesson URL from the curriculum row |
| `{{PACKAGE}}` | package.json | `ccaf-` + the folder name with `.` and `_` as `-`, e.g. `ccaf-1-1-agentic-loops` |
| `{{SUMMARY}}` | README | one paragraph: what the lesson teaches and what this program shows |
| `{{BEHAVIOURS}}` | README | the approved list, one numbered line per step: `1. **<step in a few words>.** <behaviour>` |
| `{{PROMPT}}` | README | the approved example prompt. The template wraps it in single quotes, so the shell expands nothing inside (`$HOME`, `$(...)`, backticks and backslashes stay literal); write each `'` inside it as `'\''` |
| `{{INPUTS}}` | README | the approved test inputs and the expected result, or "None beyond the prompt." |

Search the folder for `{{`. It is finished when no placeholder is left. Keep every `##` heading of the README and RESULT templates word for word, because the `exercise-completeness` hook checks for them. The README's What to watch for and Troubleshooting sections get their content after the first run.

Install the SDK that the Build Exercise uses, from inside the folder. This also installs the dev dependencies.

- `npm install @anthropic-ai/sdk` for the Messages API: `client.messages.create`, tool definitions, or a loop you write yourself.
- `npm install @anthropic-ai/claude-agent-sdk` for the Agent SDK: `query()`, subagents, hooks or sessions.

Then run `npm run typecheck`. It must exit 0.

## 6. Mark the task in progress

In the `$ARGUMENTS` row of `docs/curriculum.md`, set Folder to `` `<domain>/<folder>` `` and Status to `in progress`. Change nothing else in the file.

## 7. Hand over

Tell the user the folder path and the next steps: `/build-exercise $ARGUMENTS` writes `src/` against the acceptance behaviours in the README, then `/run-exercise $ARGUMENTS` runs it.

If the user asked for the whole exercise to be completed, invoke `build-exercise $ARGUMENTS` yourself instead of handing over.
