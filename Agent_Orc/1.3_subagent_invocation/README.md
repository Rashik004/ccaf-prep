# 1.3 Subagent Invocation and Context Passing

Lesson: [1.3 Subagent Invocation and Context Passing](https://claudecertificationguide.com/learn/1-agentic-architecture/1-3-subagent-invocation-context)

A coordinator invokes two research subagents in parallel, one searching the web and one reading local documents, then passes their structured findings verbatim to a synthesis subagent that writes a cited report.

Setup, API key, logging switches and generic troubleshooting are in the [root README](../../README.md).

## What it builds

1. The coordinator requests `web-search` and `doc-analysis` together in one model turn. The program fails the run if they ran sequentially.
2. Each research agent returns findings with source metadata (URL or document plus page).
3. The coordinator hands the complete findings to the `synthesis` agent, which writes a report where every statement cites a source.
4. The program checks every citation points at a source the researchers returned, and that every local document citation has a page number.
5. On success it prints the report to stdout and saves it as `output/<timestamp>_report.md`.

`All statements verified` means the attribution checks passed. It does not prove each statement is factually supported by the cited passage.

## Run

```sh
npm install
npm run typecheck
npm start -- "<research topic>"
```

Run from this folder so the document agent finds files in `documents/`.

### Example prompts

Supplier catalogs in `documents/` plus web sources (the run in [RESULT.md](RESULT.md)):

```sh
npm start -- "Using the catalogs in documents/, compare wholesale prices, sizes and availability for Eastern Redbud (Cercis canadensis) across suppliers, and compare with published web sources on its hardiness zones and landscape use."
```

Cost of this prompt (latest successful run, `Log/20261020-001706_run.log`): **$1.51**, 414.7 s. 14 `claude-sonnet-5-5` model calls across the coordinator and 3 subagents ($1.46: 85,425 output, 391,231 cache-read and 227,030 cache-write tokens), plus $0.05 of `claude-haiku-5-5` for the SDK's web searches. See [RESULT.md](RESULT.md#2-cost) for the per-subagent breakdown.

Web sources only:

```sh
npm start -- "What affects household heat pump running costs?"
```

A document you add yourself:

```sh
npm start -- "Compare the heat pump running costs in documents/report.pdf with published web sources."
```

No argument uses the default topic, `The impact of heat pumps on household energy bills`:

```sh
npm start
```

### Local documents

`documents/` ships ten supplier catalog PDFs. Add your own reports or PDFs there and name them in the topic. Prefer files with page numbers: the attribution check rejects document citations without one. Both researchers are invoked even when no document is relevant. Document content is sent to the model, so only add files you are willing to share with the API.

## What to watch for

- **Parallel invocation**: in the log, both `Agent` tool calls for `web-search` and `doc-analysis` sit in the same coordinator turn.
- **Context passing**: each subagent prompt in the log is self-contained; subagents do not see the coordinator's conversation.
- **Metadata preserved**: the synthesis prompt carries the researchers' findings verbatim, source fields included, so citations survive the handoff.
- **Attribution check**: the closing trace lines list each statement with its citations and the verification result.

[`subagent-prompting-guide.html`](subagent-prompting-guide.html) walks through a run of the Redbud prompt: techniques per agent, how they communicate, and the prompts and results of each subagent. [`http-flow.html`](http-flow.html) shows the HTTP flow of a run.

## Troubleshooting

| Problem | What to check |
|---|---|
| Documents are not found | Run from this folder and check the paths in your topic. |
| `Research subagents ran sequentially` | The model did not invoke both researchers in the same turn. The run is rejected; retry. |
| `Attribution check failed` | Read the reported issue: a missing or unknown citation, or a document citation without a page number. |
| `Could not parse ... output` | A research agent's output broke the JSON contract; its findings may be missing from the checks. |

## Source files

| File | Role |
|---|---|
| `src/index.ts` | Reads the topic from the arguments and prints the report. |
| `src/coordinator.ts` | Runs the coordinator, captures research results, calls the checks. |
| `src/agents.ts` | Defines the web research, document analysis and synthesis agents and their scoped tools. |
| `src/types.ts` | Findings, source metadata and synthesis output types. |
| `src/schema.ts` | JSON contracts included in the agent prompts. |
| `src/parse.ts` | Parses research output and checks the finding contract. |
| `src/synthesis-prompt.ts` | Builds the synthesis prompt from the complete research JSON. |
| `src/verify.ts` | Checks source attribution and parallel invocation. |
| `src/report.ts` | Saves the verified report as Markdown to `output/`. |
| `src/log.ts` | This lesson's trace events (agent calls, handbacks, findings, attribution) on top of `common/log.ts`. |

The coordinator enables subagents with `allowedTools: ["Agent"]` and registers the named agents under `options.agents`.
