# CCAF prep

Study repo for the **Claude Certified Architect (Foundations)** exam. Every exam task statement gets one small, runnable Node.js program that implements the lesson's Build Exercise from [claudecertificationguide.com/learn](https://claudecertificationguide.com/learn), plus a `README.md` (how to run it) and a `RESULT.md` (what happened when it ran, study points).

This file covers what every exercise shares: setup, the API key, logging and output. Each exercise's own README covers only how to run that lesson and which prompts to try.

## Exercises

[`docs/curriculum.md`](docs/curriculum.md) maps every task ID to its lesson, folder and status.

| ID | Exercise | Folder |
|---|---|---|
| 1.3 | Subagent Invocation and Context Passing | [`Agent_Orc/1.3_subagent_invocation`](Agent_Orc/1.3_subagent_invocation) |

## Layout

```
<domain folder>/<task-id>_<short_snake_title>/   one exercise per task statement
  src/            exercise code, entry point first
  README.md       how to run it, example prompts
  RESULT.md       what happened when it ran, study points
  Log/            run logs (gitignored)
  output/         artefacts the program produces (gitignored)
common/           shared helpers: .env reading, logging, timestamps
docs/             curriculum map and notes that span several tasks
```

Domain folders: `Agent_Orc` (1), `Tool_MCP` (2), `CC_Config` (3), `Prompt_Eng` (4), `Context_Mgmt` (5).

## Prerequisites

- Node.js and npm. Nothing else is installed globally; TypeScript runs directly through `tsx`.
- An Anthropic API key with API access and credits. Running an exercise calls the Anthropic API and can incur charges.

## Install

Each exercise is its own npm package. Install inside the exercise folder:

```sh
cd Agent_Orc/1.3_subagent_invocation
npm install
```

The repo root has its own `package.json` only for testing `common/` (see [Shared code](#shared-code)).

## API key and model

Exercises read two variables:

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Your API key. |
| `ANTHROPIC_MODEL` | no | Pins the model, e.g. `claude-sonnet-5-5`. Unset leaves the SDK on its default. |

Each is looked up in this order, first hit wins:

1. The `.env` file in the **repository root**. A value here wins over the terminal.
2. The terminal's environment variables.

If no key is found the program stops with an error.

### Option A: `.env` file (recommended)

Copy `example.env` to `.env` in the repository root and replace the placeholder:

```sh
ANTHROPIC_API_KEY="your-anthropic-api-key"
ANTHROPIC_MODEL="claude-sonnet-5-5"
```

`.env` is gitignored. A `.env` that still holds the `YourAnthropicApiKey` placeholder is ignored, so the terminal key is used instead.

### Option B: terminal environment variable

```powershell
# Windows PowerShell
$env:ANTHROPIC_API_KEY = "your-anthropic-api-key"
```

```sh
# macOS / Linux
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

This lasts for the current terminal session only: run the exercise in the same terminal. Never paste the key into source files or commit it.

Check it is set without printing it:

```powershell
[bool]$env:ANTHROPIC_API_KEY          # PowerShell: True
```

```sh
test -n "$ANTHROPIC_API_KEY" && echo "Key is set"
```

## Running an exercise

From the exercise folder:

```sh
npm run typecheck          # compile check, no API call
npm start -- "<prompt>"    # run; -- forwards the argument to the program
```

Keep the prompt in quotes. Inputs only ever arrive as arguments or `.env` values; nothing is interactive.

## Logs and output

Every run writes one log file, in full, to the exercise's `Log/<timestamp>_run.log`. The log is the evidence each `RESULT.md` is built from. It holds:

- a readable trace of the run;
- the complete request and response of every model call and tool call, as JSON: prompts as sent, outputs as received, model, token usage, cost, duration, including subagent prompts and handbacks.

The terminal splits the same run into two streams:

| Stream | Content |
|---|---|
| stderr | the short readable trace |
| stdout | the program's actual result only |

So `npm start -- "..." > result.txt` captures a clean result while the trace still shows on screen. Files the program produces (reports and similar) go to the exercise's `output/` folder. `Log/` and `output/` are gitignored.

A logging failure is reported on stderr and the run continues.

### Logging switches

All optional, set in the terminal:

| Variable | Effect |
|---|---|
| `DEBUG_TRACE=0` | stderr shows headlines only; the file stays complete |
| `DEBUG_TRACE_MAX=n` | truncate quoted text on stderr at `n` chars |
| `DEBUG_RAW=1` | echo raw dumps on stderr as well |
| `RUN_LOG_FILE=path` | write the log here instead of `Log/<timestamp>_run.log` |

### Analysing logs with Claude Code

Logs are large. Rather than read them by hand, open [Claude Code](https://claude.com/claude-code) in the exercise folder and ask, for example:

- `Why did the latest run in Log/ fail? Trace it back to the agent that caused it.`
- `Compare the last two runs in Log/: prompts sent, findings returned, duration and cost.`
- `Check the latest log in Log/ and the code in src/. Write an HTML walkthrough of the prompts each agent received and what it returned.`

## Shared code

`common/` holds only what the lessons do not teach:

| File | Role |
|---|---|
| `common/env.ts` | Resolves `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` from the root `.env`, then the terminal. |
| `common/log.ts` | The run log: file sink, stderr trace, JSON records of every call. |
| `common/stamp.ts` | Timestamps for file names. |

Test it from the repo root:

```sh
npm install
npm test
```

## Troubleshooting

| Problem | What to check |
|---|---|
| `npm` or `node` is not recognized | Install Node.js with npm, then reopen the terminal. |
| `tsx` or a package cannot be found | Run `npm install` in the exercise folder. |
| `ANTHROPIC_API_KEY not found` | Add the key to the root `.env` (not the placeholder) or set it in the terminal running the program. |
| Authentication or API access fails | Check the key is valid and its account has API access and credits. |
