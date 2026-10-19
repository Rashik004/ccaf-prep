# Reference: Context Passing with Structured Metadata

CCA-F Domain 1 · Task Statement 1.3: Subagent Invocation and Context Passing

## Files and steps

| File | Step | What it shows |
|---|---|---|
| `src/coordinator.ts` | 1, 4, 5, 6 | `query()` coordinator with `allowedTools: ["Agent"]`, subagents under `options.agents`, a verbatim-forwarding prompt, stream capture and both checks |
| `src/agents.ts` | 2, 4 | Three `AgentDefinition`s (`web-search`, `doc-analysis`, `synthesis`) with scoped `tools` |
| `src/types.ts` | 3, 5 | `Finding` (content separated from metadata) and the synthesis output types |
| `src/schema.ts` | 3, 4 | JSON contracts written into the subagent prompts |
| `src/parse.ts` | 3 | Enforces the finding contract where one agent hands over to the next |
| `src/synthesis-prompt.ts` | 4 | Deterministic version of "pass the full JSON verbatim" |
| `src/verify.ts` | 5, 6 | Attribution check (present, real, precise) and parallel-spawn check |
| `src/index.ts` | – | Entry point (loads `.env`, prints the verified report) |
| `src/selftest.ts` | 3–6 | Offline tests for the parser and both verifiers |

## Run

**Windows:** double-click `run.cmd`, or from a terminal in this folder:

```bat
run.cmd "your research topic"
```

**macOS/Linux:** `./run.sh "your research topic"`

On the first run the launcher installs dependencies, creates `.env` from `.env.example`
and asks you to add your `ANTHROPIC_API_KEY`. Without a topic, it uses a default heat-pump topic
that matches the sample document.

Manual equivalent:

```bash
npm install
npm test                 # offline checks, no API key needed
npm start -- "your research topic"
```

**Documents:** `doc-analysis` reads from `docs/` (or set `DOCS_DIR` in `.env`).
`docs/sample-heat-pump-study.md` is a **fictional** sample with `--- Page N ---` markers;
replace it with your own PDFs or text files.

**Requirements:** Node.js 20.12+ and an Anthropic API key.

## Headless permissions

Nobody is there to approve tool prompts, so `coordinator.ts` sets:

- `tools`: the session's tool pool (the union of every agent's scope)
- `allowedTools: ["Agent"]`: the coordinator's only pre-approved tool
- `canUseTool`: denies everything else to the coordinator, and allows research tools only inside subagents (`agentID` is set)
- `settingSources: []`: ignores your `~/.claude` settings so runs are reproducible

You'll see a `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` warning about `Agent`. This is expected:
listing `Agent` in `allowedTools` pre-approves it, so `canUseTool` is never asked about it.
That is exactly the behaviour we want for the coordinator.

## Expected output

```
→ spawning "web-search" (turn nfCpUTEo)
→ spawning "doc-analysis" (turn nfCpUTEo)   ← same turn = parallel
← "doc-analysis" returned
← "web-search" returned
→ spawning "synthesis" (turn tQxCWyCw)
← "synthesis" returned

✔ 18 findings collected in 102.5s
✔ Research subagents ran in parallel
✔ Every statement is attributed to a real source
```

## Key ideas

- **No `Agent` in `allowedTools` means no subagents.** The coordinator quietly answers from its own knowledge instead.
- **Subagents start with fresh, isolated context.** The spawn prompt is everything they know, so metadata left out of it is lost for good.
- **Parallelism comes from one model turn** containing both `Agent` calls. The SDK runs them concurrently, so you don't need `Promise.all`.
- **`fork_session` copies a conversation**, while **parallel `Agent` calls hand work to fresh specialists**.
