# Writer brief

The brief that `/build-exercise` gives each subagent that writes files. Fill in every `<…>` field, then send the whole text as the agent's prompt. The agent sees nothing else, so the brief must carry the plan's contract, not refer to it.

---

You write part of a study exercise for the Claude Certified Architect exam. The code is the study aid. A learner who has not seen the lesson reads it top to bottom once and must understand the concept from it.

**Exercise**: `<id> <title>`. Folder: `<absolute folder path>`. Concept, in one paragraph: `<what the lesson teaches>`.

**Your files**, which you create and nothing else:

<one block per file:>
- `src/<file>.ts`: <its one job>. Exports: <TypeScript signatures, exactly as in the plan>. Produces the acceptance behaviours <n, m>: <each behaviour, its log line and its check>.

**Already written**, which you read, import and do not change: `src/types.ts`, `src/log.ts`<, and others>. Read them first. Use their names and shapes exactly.

**Decisions already made**: <each point the plan settled, such as the SDK, schemas and sample data>.

**Rules**:

- Follow `<repo root>/CLAUDE.md`, sections Code rules and Logging rules. Every model call and every tool call goes through the shared logger, recorded in full: `log.record()` for a request and its response (with usage and duration), or `log.stream()` for each message of a streamed Agent SDK session.
- Write code only. Do not run `npm start` or anything else that calls the Anthropic API: a run costs money and is not your job. Do not install packages or edit `package.json`. If you need a package that is not installed, return a `QUESTION:`. The only command you run is `npm run typecheck`.
- Write for the reader:
  - Name each file and function after the role it plays in the lesson.
  - Keep control flow straight top to bottom, with early returns rather than nesting.
  - Give every exported function explicit parameter and return types.
  - Use one idea per function, and keep functions short enough to read without scrolling.
  - Leave out clever abstractions, generic helpers, unused options and defensive code for cases the exercise never meets.
- Comment the lesson, not the syntax. Put a comment where the concept happens, and say why it matters there. For example: `// stop_reason, not the text, decides whether the loop continues`. Do not comment what the next line plainly does.
- A rule from the lesson is a check in code. When it is broken, the check throws an `Error` whose message names the behaviour.

**Done when**: every file above exists with its exact exports, `npm run typecheck` in the folder reports no error in your files, and nothing outside your files changed.

**Return**: for each file, its exports, the behaviours it produces with their log lines, and any point where you had to choose something the brief did not settle. If the brief does not settle something that changes what the program teaches, write `QUESTION: <the question and the options>`, stop, and return instead of guessing.
