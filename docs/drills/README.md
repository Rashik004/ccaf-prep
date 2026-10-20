# Drills

Exam-style questions, one file per task, plus a record of quiz sessions. `/study-notes <id>` writes the questions and `/drill` asks them. This file is the format both skills follow.

## Question files: `<id>.md`

One file per task ID, such as `1.1.md`. It opens with `# <id> <title> — drills`, followed by one block per question:

```markdown
### Q<n>. <short title>
<scenario stem: a concrete situation and a "what would most effectively …" question, in the style of docs/exam-guide.md section 9>

- A. <option>
- B. <option>
- C. <option>
- D. <option>

**Answer:** B
**Why:** <the right option named by its text, why it is right, and why the others fall short>
**Source:** <the exam-guide Task Statement line, the RESULT.md study point, or the lesson>
```

Rules:

- A question tests what the exam guide's `Task Statement <id>` lists: a decision an architect makes, with plausible distractors. Each distractor is an approach a reasonable person might pick.
- **Why** names the right option by its text as well as its letter, because `/drill` shuffles the options.
- Each `/study-notes` run appends five questions, numbering on from the file's last `Q<n>`. Existing questions stay as they are.

## Session record: `history.md`

`/drill` appends one line per session:

```
<YYYY-MM-DD> | <scope: 1.3, D1 or all> | <right>/<asked> | asked: <id>#Q<n>, … | missed: <id>#Q<n>, …
```

`asked` lists every saved question asked in the session; `missed` the ones answered wrong, or `none`. Unsaved generated questions are counted in `<right>/<asked>` but listed in neither.

A question is a **weak spot** when the latest line that lists it under `asked` also lists it under `missed`. Answering it right in a later session clears it. The next `/drill` session asks the weak spots in its scope first, most recently missed first.
