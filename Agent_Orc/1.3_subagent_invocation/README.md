# Subagent Invocation and Context Passing

A TypeScript research example for **CCA-F Domain 1, Task Statement 1.3**. A coordinator asks two research agents to search the web and read local documents, then passes their structured findings to a synthesis agent to produce a cited report.

## Prerequisites

- Node.js and npm.
- An Anthropic API key with API access and available credits.
- An internet connection for API requests and web research. Running the program uses the Anthropic API and can incur charges.

## 1. Install dependencies

Open a terminal in this project directory, alongside `package.json`, and run:

```sh
npm install
```

## 2. Set your Anthropic API key

The program looks for a key named **`ANTHROPIC_API_KEY`** in this order and uses the first one it finds:

1. The `.env` file in the **repository root**, two levels above this directory. If it has a real key, that key is used even when the terminal also has one.
2. The terminal's environment variables.

If neither has a key, the program stops with an error.

### Option A: `.env` file (recommended)

Copy `example.env` to `.env` in the repository root and replace the placeholder value with your actual key:

```sh
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

`.env` is listed in the root `.gitignore`. A `.env` that still holds the `YourAnthropicApiKey` placeholder is ignored, so the terminal key is used instead.

### Option B: terminal environment variable

Set the key in the terminal where you will run the program. Replace `your-anthropic-api-key` below with your actual key.

**Windows PowerShell:**

```powershell
$env:ANTHROPIC_API_KEY = "your-anthropic-api-key"
```

**macOS / Linux (Bash or Zsh):**

```sh
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

These commands set the key for the current terminal session and the programs it starts. Set it again when you open a new terminal.

**Do not paste the key into the source files or commit it to source control.**

To check that the terminal variable is set without printing the key:

```powershell
# PowerShell: should print True
[bool]$env:ANTHROPIC_API_KEY
```

```sh
# Bash / Zsh
test -n "$ANTHROPIC_API_KEY" && echo "Key is set"
```

## 3. Add local documents (optional)

Place relevant reports, papers, or PDFs in the project directory, or a subdirectory such as `documents/`. Run the program from the project directory so the document agent can find them. You can mention particular filenames in your research topic.

The coordinator invokes both research agents even if you provide no local documents. Use documents with identifiable page numbers when possible: the attribution check rejects local document citations that have no page number. Document content read by the agent is sent to the model, so use files you intend to share with the API.

## 4. Check and run

Check the TypeScript code without making an API call:

```sh
npm run typecheck
```

Then run a research topic from the project directory (if you use a terminal variable instead of `.env`, run it **in the same terminal where you set the key**):

```sh
npm start -- "What affects household heat pump running costs?"
```

The `--` forwards the topic to the program. Keep the topic in quotes. For a topic tied to a local document, first add the file, then run:

```sh
npm start -- "Compare the heat pump running costs in documents/report.pdf with published web sources."
```

You can also use the built-in default topic:

```sh
npm start
```

The default is `The impact of heat pumps on household energy bills`.

## What happens when it runs

1. The coordinator requests `web-search` and `doc-analysis` together in one model turn.
2. Each research agent returns findings with source metadata.
3. The coordinator instructs the `synthesis` agent to combine the complete findings into a cited report.
4. The program checks that both research agents were invoked in the same turn and that report statements cite sources returned by the researchers. Local document citations must include page numbers.
5. If the checks pass, the terminal displays the finding count, a summary, and numbered statements with citations. The program does not save a report file automatically.

The success message `All statements verified` refers to these attribution checks. It does not independently establish that each statement is factually correct or supported by the cited passage.

## Troubleshooting

| Problem | What to check |
|---|---|
| `npm` or `node` is not recognized | Install Node.js with npm, then reopen your terminal. |
| `tsx` or a package cannot be found | Run `npm install` from the directory containing `package.json`. |
| Authentication or API access fails | Check that `ANTHROPIC_API_KEY` is in the repo-root `.env` (with a real value, not the placeholder) or set in the terminal running the program, that the key is valid, and that its account has API access and credits. |
| Documents are not found | Run from the project directory and check the filenames or paths in your topic. |
| `Research subagents ran sequentially` | The model did not invoke both researchers in the same turn. The program rejects that run; retry the command. |
| `Attribution check failed` | Read the reported issue. The report may contain missing or unknown citations, or a local document citation without a page number. |
| `Could not parse ... output` | A research agent returned output that did not match the expected JSON contract; its findings may be missing from the final checks. |

## Source files

| File | Purpose |
|---|---|
| `src/index.ts` | Reads the topic from command-line arguments and prints the report. |
| `../../env.ts` (repo root) | Resolves `ANTHROPIC_API_KEY` from the root `.env` first, then the terminal. |
| `src/coordinator.ts` | Runs the coordinator, captures research results, and calls the verification functions. |
| `src/agents.ts` | Defines the web research, document analysis, and synthesis agents and their scoped tools. |
| `src/types.ts` | Defines findings, source metadata, and synthesis output types. |
| `src/schema.ts` | Defines the JSON contracts included in agent prompts. |
| `src/parse.ts` | Parses research output and checks the finding contract. |
| `src/synthesis-prompt.ts` | Provides a helper for building a prompt from complete research JSON. |
| `src/verify.ts` | Checks source attribution and parallel research invocation. |

The coordinator enables subagent invocation with `allowedTools: ["Agent"]` and registers the named agents under `options.agents`. Research agents receive separate task context, so preserving the source metadata when passing findings to synthesis is central to this example.
