# 1.3 Subagent Invocation and Context Passing — result

Lesson: https://claudecertificationguide.com/learn/1-agentic-architecture/1-3-subagent-invocation-context

## 1. Run

Date: 2026-10-19, 22:17 local (16:17 UTC). Model: `claude-sonnet-5-5` for the coordinator, inherited by every subagent.

```sh
npm start -- "Using the catalogs in documents/, compare wholesale prices, sizes and availability for Eastern Redbud (Cercis canadensis) across suppliers, and compare with published web sources on its hardiness zones and landscape use."
```

Log: `Log/20261019-221746_run.log` (1.07 MB, 145 stream messages). Report: `output/20261019-221746_report.md`.

## 2. What happened

The coordinator announced the plan, then put two Agent calls in one assistant message:

```
🧠 coordinator says:
   > Launching both research subagents in parallel.

── Agent call ▶ web-search   (turn msg_011CgBu1bKRrn62kbPjJ6ZPy, call toolu_01UmTXAohFr1VFtE8G6MGy1q)
   model : claude-sonnet-5-5  (inherited from coordinator)
   task  : Web research redbud zones
   background: false
   prompt:
   > Topic: Eastern Redbud (Cercis canadensis). Scope: find published web sources on (1) its USDA hardiness zone range and (2) its landscape use (...). Prefer authoritative sources: university extension services, botanical gardens and arboretums, USDA or US Forest Service (...). Leave out supplier prices, nursery catalogs and retail listings.

── Agent call ▶ doc-analysis   (turn msg_011CgBu1bKRrn62kbPjJ6ZPy, call toolu_01KuXNVqSSD5VWHdCJrXvAnB)
   model : claude-sonnet-5-5  (inherited from coordinator)
   task  : Catalog analysis redbud pricing
   background: false
   prompt:
   > Topic: Eastern Redbud (Cercis canadensis). Scope: analyse the supplier catalogs in the documents/ folder of the working directory (...). For each entry capture the wholesale price (and any quantity or price breaks), the available sizes or container and caliper specs, and availability or stock status, and note the supplier name, the document name and the page number. (...) Leave out all web sources and any plants other than Cercis.
```

Both prompts state topic and scope only. The coordinator's system prompt forbids it from describing an output format, because a schema in the call prompt overrides the subagent's own.

The two researchers ran side by side and handed back through `SubagentHandback`; the Agent `tool_result` was only a stub:

```
↩ web-search: read 9008 chars from its SubagentHandback report (tool_result was a 349-char stub)
← web-search returned 9008 chars in 89.5s
  web-search: 15 finding(s) parsed
↩ doc-analysis: read 16139 chars from its SubagentHandback report (tool_result was a 351-char stub)
← doc-analysis returned 16139 chars in 94.7s
  doc-analysis: 24 finding(s) parsed
```

The coordinator then invoked synthesis in a new turn, with both JSON payloads pasted verbatim into the prompt:

```
🧠 coordinator says:
   > Both research subagents returned. Sending both complete JSON outputs to synthesis, copied verbatim.

── Agent call ▶ synthesis   (turn msg_011CgBu9bUpj9KjQaUT2WwPc, call toolu_01UuXgYiApTPnegeuFF9jArv)
   prompt:
   > Topic: Using the catalogs in documents/, compare wholesale prices (...)
   >
   > === WEB-SEARCH OUTPUT ===
   > {"agent":"web-search","findings":[{"claim":"University of Wisconsin Extension Horticulture gives the hardiness range of eastern redbud as zones 4a to 9b. (...)
   >
   > === DOC-ANALYSIS OUTPUT ===
   > {"agent":"doc-analysis","findings":[{"claim":"Greenleaf Wholesale Nursery (Hillsboro, OR; Spring 2027 catalog) lists Eastern Redbud (Cercis canadensis), SKU GW-1002, in the TREES table. Price $159.36 per unit. (...)

← synthesis returned 26189 chars in 96.3s
```

The coordinator returned the synthesis JSON as its final answer and the session closed:

```
■ coordinator finished — subtype=success, 316.5s, 4 turns, $1.1488
```

Usage from the `result` message: 25,018 output tokens (1,504 of them thinking), 108,266 cache-read input tokens, 37,586 cache-creation input tokens. Both verification checks passed. The saved report has 39 findings behind 20-odd statements, each cited, for example:

```
3. Size class #7 container, 5-6 ft: Evergreen Horizons Nursery (EH-1001) lists Eastern Redbud at $74.30 per unit, and Heritage Hills Wholesale (HH-1002) lists it at $76.48. (...)
   [05_evergreen-horizons-nursery_catalog.pdf, p.1; 10_heritage-hills-wholesale_catalog.pdf, p.1]
```

## 3. Acceptance behaviours

| Behaviour | Showed up | Evidence |
|---|---|---|
| Independent research runs in parallel: both research subagents are invoked in the same model turn | Yes | Both `Agent call` blocks carry turn `msg_011CgBu1bKRrn62kbPjJ6ZPy`; `verifyParallelResearch` passed on that turn map. |
| Each subagent receives only the context it needs, in its prompt | Yes | Prompts above: topic and scope, no output schema, no mention of the other agent. Scope lines exclude the other agent's territory ("Leave out supplier prices", "Leave out all web sources"). |
| Structured findings are passed to the next stage without loss | Yes | The synthesis prompt embeds both JSON payloads under `=== WEB-SEARCH OUTPUT ===` and `=== DOC-ANALYSIS OUTPUT ===`; 15 + 24 = 39 findings in, 39 findings counted at the end. |
| Every statement in the report is attributed to a source a researcher actually returned, with page numbers for documents | Yes | `verifyAttribution` passed (0 issues); saved report cites `<file>.pdf, p.N` for each document claim. |
| Each subagent is scoped to the tools its job needs | Partly observed | Defined in code (`web-search`: WebSearch, WebFetch; `doc-analysis`: Read, Grep, Glob; `synthesis`: none). The log prints the coordinator's tool list but not each subagent's, so the scoping is asserted by the definition, not by the trace. See section 5. |

## 4. Study points

- **A subagent is a definition, not a class.** It is an `AgentDefinition` keyed by name under the coordinator's `agents` option: `description` (routing information the coordinator reads to decide who to call), `prompt` (the subagent's system prompt), `tools` (least privilege), optional `model`. The coordinator invokes it through the `Agent` tool with `subagent_type` set to that name. The exam guide calls this tool `Task`.
- **Context passing means the call prompt is the whole context.** The subagent does not see the coordinator's conversation. Whatever it needs (topic, scope, where to look, what to leave out) is written into the prompt by the coordinator. What it must not see (the other agent's work, an output schema that would override its own) is left out.
- **Parallel is one message with several tool_use blocks.** Sequential is several turns. The trace proves parallelism by the shared assistant message id, which is why the exercise records calls per turn id and asserts on it.
- **The tool_result is not the payload.** With subagents, the Agent `tool_result` was a ~350-character stub; the real report arrived through a `SubagentHandback` carried on the same user message (`tool_use_result.handbackReport.text`). A background subagent returns only a launch receipt, so the exercise sets `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` and the coordinator prompt demands `run_in_background: false`.
- **Pass structured output verbatim to preserve provenance.** Summarising between stages drops `source_url`, `document_name`, `page_number`. The synthesis agent has no tools, so it cannot add unattributed material; the attribution check then only has to compare citations to the set of URLs the researchers returned. This is the link to task 5.6 (information provenance).
- **Fail fast at the boundary.** A research payload that does not parse stops the run before synthesis is bought. Letting it continue would have produced a report whose citations the check was guaranteed to reject, with the blame landing on the wrong agent. Link to task 5.3 (error propagation).
- **Model inheritance.** A subagent runs on its own `model` if set, otherwise the coordinator's. All three inherited `claude-sonnet-5-5` here.
- **Cost shape.** One coordinator session with three subagent calls: 4 coordinator turns, about 5 minutes, $1.15. The subagents' token use is folded into the session's `total_cost_usd`; the coordinator itself did little (two short text turns, three tool calls).
- **Things the lesson did not say, the log did.** The SDK session inherits the user-level Claude Code configuration: 15 `hook_started` / `hook_response` messages fired before the first model turn, from this machine's `SessionStart` hooks. The coordinator's tool list in the init message also exposed every built-in tool, even though `allowedTools` restricted it to `Agent`; the restriction is enforced at call time, not in the advertised list.
- **Contrast with neighbours.** 1.2 names the pattern (coordinator fan-out and synthesis); 1.3 is the mechanics of one hop: what goes into the prompt, what comes back and how. 1.6 is about how the coordinator chose to split by source type in the first place.

## 5. Open questions and next tries

- Does the log show each subagent's tool list anywhere (the `task_started` message, or the subagent's own `init`)? Grep the stream records for `tools` under `parent_tool_use_id`.
- Can the SDK session be told to ignore user-level settings and hooks, so the trace starts at the first model turn? Check the `settingSources` option.
- Force a sequential run (coordinator prompt without the "single response" rule) and watch `verifyParallelResearch` fail, to see the turn map it prints.
- Give one research agent an explicit `model` override and confirm the `agent override` source appears in the trace.
- Run once with `DEBUG_TRACE=0` to see the headline-only view the shared logger now provides.
