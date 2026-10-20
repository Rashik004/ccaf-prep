---
name: new-exercise
description: Start the exercise for one curriculum task ID. Researches the lesson, writes the acceptance behaviours, scaffolds the folder and marks the task in progress.
argument-hint: <task-id, e.g. 1.1>
disable-model-invocation: true
---

Start the exercise for task **$ARGUMENTS**. This skill covers steps 1 to 4 of "Starting a new exercise" in `CLAUDE.md`: research, acceptance behaviours, scaffold, status. It ends with a review of the acceptance list. The code is written after the user approves that list.

## 1. Check the task

Find the `$ARGUMENTS` row in `docs/curriculum.md`. The row gives the title, the lesson URL, the folder and the status. Stop and tell the user if:

- there is no row,
- the status is `done`, or
- the folder already exists with a `src/` folder in it.

## 2. Research the lesson

Dispatch the **lesson-researcher** agent with the task ID. Its brief has the headings `Concepts`, `Acceptance behaviours`, `Suggested scenario`, `Anthropic doc links` and `Neighbouring tasks`. Under `Acceptance behaviours` the brief must also give the Build Exercise text in a quote block. If the quote block is missing, send the brief back and ask for it.

If `Acceptance behaviours` says `NO BUILD EXERCISE FOUND`, stop. Show the user what the agent tried, and ask how to go on.

Read the `#### Task Statement $ARGUMENTS:` section of `docs/exam-guide.md` yourself. It tells you what the exam tests, and step 3 uses it.

## 3. Write the acceptance behaviours

Go through the brief's list against its Build Exercise quote. You need exactly one behaviour per step, and each behaviour must name what the program's output or log shows. A behaviour that describes code ("a constant exists") is not finished: rewrite it as a log line or stdout content. Where the task statement names a skill the steps also exercise, make the behaviour show it. The list is finished when you could check each line against a run log with grep.

## 4. Scaffold the folder

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
| `{{BEHAVIOURS}}` | README | the step 3 list, one numbered line per step: `1. **<step in a few words>.** <behaviour>` |

Search the folder for `{{`. It is finished when no placeholder is left. Keep every `##` heading of the README and RESULT templates word for word, because the `exercise-completeness` hook checks for them. The README's Run, What to watch for and Troubleshooting sections get their content after the first run.

Install the SDK that the Build Exercise uses, from inside the folder. This also installs the dev dependencies.

- `npm install @anthropic-ai/sdk` for the Messages API: `client.messages.create`, tool definitions, or a loop you write yourself.
- `npm install @anthropic-ai/claude-agent-sdk` for the Agent SDK: `query()`, subagents, hooks or sessions.

Then run `npm run typecheck`. It must exit 0.

## 5. Mark the task in progress

In the `$ARGUMENTS` row of `docs/curriculum.md`, set Folder to `` `<domain>/<folder>` `` and Status to `in progress`. Then run `git diff docs/curriculum.md`: it must show exactly that one row changed.

## 6. Review

Print to the user:

- the folder path,
- the numbered acceptance behaviours,
- the suggested scenario, marked "proposed" where the lesson gave no inputs,
- the next step: write `src/` against these behaviours, then run `/run-exercise $ARGUMENTS`.

Ask the user to approve or correct the acceptance list before you write any code.
