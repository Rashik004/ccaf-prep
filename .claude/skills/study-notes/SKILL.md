---
name: study-notes
description: Write an exercise's revision notes - RESULT.md sections 5 and 6 (study points, open questions) plus five exam-style drill questions in docs/drills/<id>.md. Use it after a run's write-up, or when asked for study notes or practice questions on a task.
argument-hint: <task-id>
---

Write the study notes for task **$ARGUMENTS**: the part of RESULT.md the user revises from, and five questions `/drill` will ask later. The notes connect what the exam tests for this task with what the run actually showed.

## 1. Check the exercise

Find the `$ARGUMENTS` row in `docs/curriculum.md` and open `<folder>/RESULT.md`. Stop and tell the user if:

- the row has no folder, or the folder has no RESULT.md,
- RESULT.md sections `## 1. Run` to `## 3. What happened` are empty: there is no run to learn from yet (run `/run-exercise $ARGUMENTS`).

## 2. Gather the sources

- Dispatch the **lesson-researcher** agent with `model: "sonnet"` and `effort: "medium"` on `$ARGUMENTS`. Use its `Concepts`, `Neighbouring tasks` and `Anthropic doc links`.
- Read the `#### Task Statement $ARGUMENTS` section of `docs/exam-guide.md` yourself: the knowledge and skills the exam tests here.
- Read `docs/exam-guide.md` section `## 9. Sample Questions` for the question style, and `docs/drills/README.md` for the drill format.
- Read RESULT.md sections 1 to 4: what this run did and showed.

## 3. Draft sections 5 and 6

- **`## 5. Study points`**: bullets, each one idea in bold followed by its explanation.
  - What the exam expects you to know for this task, from the task statement, in plain words.
  - What this run taught that the lesson did not say, quoting the RESULT.md trace where it helps.
  - Contrasts with neighbouring tasks: when to pick this pattern over that one.
- **`## 6. Open questions and next tries`**: bullets of things to try next with this exercise, each concrete enough to act on (what to change, what to look for in the log).

## 4. Write sections 5 and 6, with the user's approval

The sections belong to the user. Show the draft in chat, then:

- **Both sections empty**: ask with AskUserQuestion: write it, change it (take their corrections and show the draft again), or stop.
- **Either section has content**: ask with AskUserQuestion: keep the existing sections and write only drills, replace them with the draft, or append the draft below the existing text.

Write only what the user chose, keeping both headings word for word.

## 5. Write five drill questions

Append five questions to `docs/drills/$ARGUMENTS.md` in the format of `docs/drills/README.md`. Create the file with its `# $ARGUMENTS <title> — drills` heading if it does not exist, and number on from its last `Q<n>`. Each question tests a point from the task statement, through a scenario like the exam's, with four plausible options. Spread the five across different points of the task statement rather than five takes on one.

## 6. Report

Tell the user what was written: which RESULT sections (or kept as they were) and the five question titles. Suggest `/drill $ARGUMENTS`.

Done when RESULT.md sections 5 and 6 hold the approved text (or were kept by the user's choice) and `docs/drills/$ARGUMENTS.md` has five new questions in the drill format.
