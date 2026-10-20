---
name: drill
description: Quiz the user with exam-style multiple-choice questions from docs/drills/, grade each answer, and record missed questions. Use it when asked to drill, quiz, test or practise for the exam, on one task, one domain or everything.
argument-hint: [task-id | domain number] [count]
---

Quiz the user on **$ARGUMENTS**. This is retrieval practice for the exam: the user answers before seeing anything that gives the answer away, then gets the reasoning.

## 1. Read the scope

From the arguments:

- **Scope**: a task ID (`1.3`) means `docs/drills/1.3.md`; a domain number (`1`) means every `docs/drills/1.*.md`; nothing means every question file. A question file is any `docs/drills/<id>.md`; `README.md` and `history.md` are not.
- **Count**: a number after the scope, else 5.

## 2. Build the pool

Read the question files in scope (format: `docs/drills/README.md`). Then read `docs/drills/history.md` if it exists. Questions listed under `missed:` there go first, newest session first; the rest follow in random order. Take `count` questions.

If the files in scope hold fewer than `count` questions, write the missing ones yourself from the `## 5. Study points` sections of the RESULT.md files in scope (the curriculum rows give the folders), in the same format, and tell the user they are new and unsaved. If there are neither questions nor study points in scope, stop: there is nothing to drill yet; `/study-notes <id>` writes the first questions.

## 3. Ask, one question at a time

For each question, one AskUserQuestion call:

- `question`: the stem, with `Q<k> of <count>` in front.
- `header`: the task ID, such as `1.3 Q2`.
- `options`: the four options in shuffled order. `label` is the new letter and a 2 to 4 word gist; `description` is the full option text.

Keep the answer and the **Why** line out of the call. An "Other" reply counts as wrong unless it clearly states the right option's approach.

After each answer, tell the user right or wrong, the right option (by its text, since the letters moved), and the **Why** line. Then ask the next question.

## 4. Score and record

Show the score and, for each miss, its `<id>#Q<n>` and title. Then append one line to `docs/drills/history.md` in the format of `docs/drills/README.md`, creating the file with a `# Drill history` heading if needed. Unsaved generated questions do not go in the line.

Done when every question has been asked and graded, the score is shown, and the history line is written.
