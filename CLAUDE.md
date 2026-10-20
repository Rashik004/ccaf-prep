# CCAF prep

Study repo for the Claude Certified Architect (Foundations) exam. Every exam task statement gets one small, runnable Node.js program that implements the lesson's **Build Exercise**, plus four write-ups: README, RESULT, a code gist and a log data-flow page. The program is the study aid; the write-ups are the revision notes.

## Source of truth

- Curriculum: https://claudecertificationguide.com/learn. `docs/curriculum.md` maps every task ID to its lesson URL, folder and status. Each lesson page ends with a **Build Exercise** section (after Practice Scenario, before Sources). That section is the exercise's spec: the code builds what it describes, not an exercise of our own design.
- Exam guide: `docs/exam-guide.md`, a text extract of `ccaf_exam_guide_by_claude.pdf` (read the markdown, not the PDF). Each task has a `#### Task Statement <id>` heading listing the knowledge and skills tested; section 8 has preparation exercises, section 9 sample questions, section 17 in/out-of-scope topics. Before working on a task or domain, read its section in the guide for what the exam tests there, and use that to shape the acceptance behaviours and the RESULT.md study points. The guide sets the exam's scope; the lesson's Build Exercise still sets what the code builds.
- Anthropic documentation for API and SDK specifics. The study site gives the *why*; the docs give the *how*.
- Task IDs (`1.3`, `4.2`) are the shared vocabulary across folders, commits, notes and conversation. Use them everywhere.

## Layout

```
<domain folder>/<task-id>_<short_snake_title>/   one exercise per task statement
  src/            exercise code, entry point first
  README.md       what it demonstrates, how to run it
  RESULT.md       what happened when it ran, study points
  Gist_<task-id>.html            code walkthrough with a program-flow diagram
  Log_data_flow_<task-id>.html   real data flow of one run, from its log
  Log/            run logs (gitignored)
  output/         artefacts the program produces (gitignored)
common/           shared helpers that sit outside the lessons' scope
docs/             curriculum map, harness todo, notes that span several tasks
```

Domain folders: `Agent_Orc` (1), `Tool_MCP` (2), `CC_Config` (3), `Prompt_Eng` (4), `Context_Mgmt` (5). Each exercise is its own npm package with its own `package.json`, so it runs and reads in isolation.

## Starting a new exercise

1. Read the task's `Task Statement` section in `docs/exam-guide.md`. Fetch the lesson page for the task ID. Read the lesson for the *why*, then the **Build Exercise** section in full: its steps, tools, schemas, hints and success criteria. If the page has no Build Exercise, stop and ask the user.
2. Write down each Build Exercise step with its success criterion, one sentence each. These are the exercise's **acceptance behaviours**. Done when every step has one and each is observable in the program's output or log, not merely describable.
3. Build exactly what the Build Exercise specifies: its tools, its scenario, its step order, its test cases. Every exercise step maps to code plus a logged check. Where the exercise leaves a choice open (sample data, wording), take the smallest option that satisfies it; add nothing it does not ask for.
4. Scaffold the folder from the layout above. Set the task to `in progress` in `docs/curriculum.md`.
5. Write the code (rules below) and run it. The exercise is done when a run completes, the log shows every acceptance behaviour, and all four write-ups exist: README, RESULT, gist, data flow.
6. Set the task to `done` in `docs/curriculum.md`.

## Code rules

- Node.js runtime, TypeScript source executed directly with `tsx`, ES modules. Node and npm are the only global tools required.
- One entry point per exercise, started with `npm start`. Inputs arrive as command-line arguments or `.env` values; nothing interactive.
- `common/` holds only what the lessons do not teach: reading `.env`, logging, timestamps, paths. Anything a lesson is *about* stays inside the exercise, even when it looks reusable. An exercise reads fully without opening `common/`.
- Secrets come from the repo-root `.env` (template in `example.env`) or the terminal, never from source.
- One job per file, each short enough to read in one sitting. Name files and functions after the role they play in the lesson (`coordinator`, `synthesis-prompt`, `verify`). Comments explain the lesson concept at that spot, for example "findings are passed verbatim so the synthesiser keeps the source metadata".
- Checks are code, not prose. When the lesson says "both subagents are invoked in the same turn", the program asserts it and fails loudly when it is false.

## Logging rules

Logs are the evidence RESULT.md is built from, so every run writes one, always to file, in full.

- One file per run in the exercise's `Log/` folder, named by timestamp, folder created on demand.
- The file holds a readable trace plus the complete request and response of every model call and every tool call: prompts as sent, outputs as received, model name, token usage, cost when available, duration. Subagent prompts and handbacks included.
- The terminal shows a short trace on stderr; the program's actual result goes to stdout alone, so redirecting stdout yields a clean result.
- A logging failure is reported and the run continues.

## README.md, repo root

Holds everything the exercises share, so no exercise README repeats it: prerequisites, install, the API key and model (`.env` vs terminal), running an exercise in general, logs and output (`Log/`, stderr vs stdout, logging switches), analysing logs with Claude Code, `common/`, generic troubleshooting, and the exercise index. Add a row to the index when an exercise is done, linking its four write-ups.

## README.md, per exercise

Written for a reader who has not seen the lesson. Focus on running this lesson's program; link to the root README for setup, env and logging instead of repeating them. Sections, in this order:

1. Task ID, lesson title, link to the lesson page, one-paragraph summary, link to the root README.
2. What the program builds: the Build Exercise steps, each with its acceptance behaviour.
3. Run: the exact commands, then example prompts (the one used in RESULT.md first) and any lesson-specific inputs such as sample documents. Give the cost of running the example prompt: model, model calls, input/output tokens and USD total, taken from the RESULT.md run's log.
4. What to watch for in the output and the log, so the reader sees the concept, not just a result.
5. Lesson-specific troubleshooting only.
6. Source files: a table of file and the role it plays.

## RESULT.md, per exercise

Written after a successful run. This is the revision material.

1. The command that was run and the date.
2. Cost of the run: model, number of model calls, input/output tokens and USD total from the log, plus a per-call breakdown when the run has more than one call (coordinator vs subagents, retries).
3. What happened: a condensed trace with the relevant log excerpts (prompts, decisions, handoffs, tool calls). Quote the log rather than paraphrase it.
4. Each acceptance behaviour, one line: did it show up, and the log evidence.
5. Study points: what the exam expects you to know about this task, in your own words, plus anything the run taught that the lesson did not say. Contrast with neighbouring tasks: when to pick this pattern over that one.
6. Open questions and things to try next.

## HTML write-ups, per exercise

Two single-file pages in the exercise folder, named with the task ID (`Gist_1.4.html`, `Log_data_flow_1.4.html`). Shared rules:

- Self-contained: inline CSS, light and dark themes, readable at phone width. Diagrams are Mermaid, loaded from a pinned-version `cdn.jsdelivr.net/npm/mermaid@<x.y.z>` script; nothing else external.
- Header: task ID, lesson title with link, one-line summary, links to README, RESULT and the other page.
- Committed to git, like README and RESULT.
- Exercise 1.3 predates these pages. Its `http-flow.html` and `subagent-prompting-guide.html` stay as they are.

### Gist_<task-id>.html

The code view: how the program implements the lesson. Written from `src/`, so it can be written before the paid run.

1. Program-flow diagram (Mermaid flowchart): entry, agents, model calls, tool calls and checks, nodes named after the files and functions in `src/`. Draw the lesson concept; leave out plumbing such as `.env` reading and logging.
2. Important steps, in program-flow order. Each: a short source excerpt with `file:line`, what it does, and why it is there in lesson terms. Done when every acceptance behaviour maps to at least one step.

### Log_data_flow_<task-id>.html

The wire view: what actually travelled between program, model and tools in one run. Built from the run RESULT.md cites, so the numbers match. Get the facts through the `log-analyst` agent; the log stays out of the main context.

1. The run: log file name, date, command, model, totals for calls, tokens, cost and duration.
2. Sequence diagram (Mermaid `sequenceDiagram`) of every model call and tool call in order, participants named after the lesson's roles (coordinator, subagent, tool, API).
3. Call table: number, role, model, input/output tokens, duration, stop reason.
4. Example request and response: at least one pair per distinct kind of call (first turn, tool-use turn, subagent, final turn), shaped as Messages API `POST /v1/messages` JSON. Logs record fields, not raw HTTP, so the bodies are reconstructed: mark each one *reconstructed* and cite the log line numbers its values come from.
5. Limits: what the log does not show.

## Git

- One task ID per commit, named in the subject: `feat(1.3): ...`, `docs(1.3): ...`.
- Generated files stay out of git: `Log/`, `output/`, `node_modules/`, `.env`, `.reports/`.
