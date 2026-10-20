# 1.1 Agentic Loops

Lesson: https://claudecertificationguide.com/learn/1-agentic-architecture/1-1-agentic-loops

An agentic loop is the plain code around Claude that keeps a task going: send the conversation, read `stop_reason`, run the tools Claude asked for on `tool_use`, append their results to the history, and stop on `end_turn`. The lesson teaches that `stop_reason` is the only reliable loop signal. Parsing phrases like "I'm done", treating a text block as completion, or relying on an iteration cap are anti-patterns; a cap is only a safety net. This program hand-writes that loop with the Messages API and two tools, a calculator and a mock web search. It gives Claude a prompt that needs a search followed by a calculation on the search result, so the log shows the model choosing tools in order, each `tool_result` flowing back into the history, and the loop ending on `end_turn` well under its cap of 20.

Setup, API key and logging: see the [root README](../../README.md).

## What it builds

1. **Two tools registered.** The log prints both definitions in full: `calculator` (`expression: string`, required) and `web_search` (`query: string`, required), each with `name`, `description` and `input_schema.type="object"`. The program asserts this and logs `CHECK tools registered: calculator, web_search (input_schema ok)`; the first request in the log carries a `tools` array of length 2.
2. **Agentic loop on stop_reason.** Each iteration logs `iteration N/20: messages.create -> stop_reason=<value> content=[<block types>]`, followed by the full request and response (model, usage, duration). There is one line per call, and the last shows `stop_reason=end_turn`. `content=[...]` makes text next to `tool_use` visible, and the loop still continues.
3. **tool_use handled.** For each `tool_use` block the log shows `tool call <name> id=<toolu_…> input=…` and its `tool result`, then `appended assistant + user(tool_result tool_use_id=toolu_…) messages=<n>` with the count up by 2. The next request body holds that `tool_result`. The program asserts the `tool_use_id` matches and logs `CHECK tool_result ids match`.
4. **end_turn handled.** The log shows `stop_reason=end_turn -> loop exit`. The final response text goes to stdout, and nothing else does. Exit depends on `stop_reason` alone: no phrase matching, no `content[0].type` check.
5. **Sequential multi-tool test.** At least 2 `tool_use` iterations come before `end_turn`, with `web_search` before `calculator`, and the calculator `expression` contains `5600000`. The program asserts all three and logs `CHECK sequential: 2 tool iterations, web_search -> calculator, search value used`. The stdout answer contains `560,000` or `560000`.
6. **Safety cap 20.** The log records `MAX_ITERATIONS=20`, and every iteration line shows `N/20`. A cap hit logs `WARN cap reached` and exits non-zero. A normal run ends with `loop ended by stop_reason=end_turn after 3 iterations (cap 20 not reached)` and has no `WARN` line.

## Run

```sh
npm install
npm start -- 'Search for the population of Norway, then calculate 10% of it.'
```

Test inputs: `web_search` is a stub. A query containing "norway" and "population" returns `[{"title":"Norway population (mock)","snippet":"Norway's population is 5,600,000 (mock figure)."}]`, and any other query returns `[]`. `calculator` evaluates digits and `+ - * / ( ) .` without `eval`; invalid input returns a `tool_result` with `is_error: true`. Expected result: 3 model calls, `web_search` → `calculator` (e.g. `5600000 * 0.1`) → `end_turn`, and stdout says 10% is 560,000.

Cost of the example prompt: (from the RESULT.md run's log).

## What to watch for

## Troubleshooting

## Source files

| File | Role |
|---|---|
| `src/index.ts` | Entry point: registers and checks the tools (step 1), runs the loop, runs the sequential test (step 5), prints Claude's answer to stdout. |
| `src/agent-loop.ts` | The agentic loop (steps 2, 3, 4, 6): sends the full history, branches on `stop_reason`, runs `tool_use` blocks, appends `tool_result`s, stops on `end_turn`, `MAX_ITERATIONS = 20` safety cap. |
| `src/tools.ts` | The two tool definitions (`calculator`, `web_search`), the mock search stub, and `runTool()` which turns failures into `is_error` results. |
| `src/calculator.ts` | Small arithmetic parser behind the calculator tool, used instead of `eval()`. |
| `src/checks.ts` | The lesson's rules as code: tools registered, `tool_result` ids match `tool_use` ids, search-then-calculate sequence with the searched value carried through. Each throws when broken. |
| `src/types.ts` | Shared shapes: `ToolOutput`, `ToolCall`, `Usage`, `LoopResult`. |
| `src/log.ts` | This lesson's trace events on top of `common/log.ts`: iteration lines, tool calls, history appends, checks, loop exit, cap warning. |
