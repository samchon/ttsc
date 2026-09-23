# Graph MCP

Read this document through the project skill before changing `packages/graph`, its MCP instruction, schema, or tool descriptions, graph benchmark prompts, or the graph benchmark website. [packages/graph/README.md](../../../packages/graph/README.md) explains how the tool works and why; this document holds the rules a change must keep.

## Product

`@ttsc/graph` is a compiler-derived TypeScript index for coding agents. It exposes declarations, signatures, relationships, decorators, tests, and source spans from the resident `Program` and `TypeChecker`. It never inlines implementation bodies: when source text is needed, it returns the smallest span and lets the agent read it normally.

A citation target that is not a TypeScript declaration (a document section, a data model field, an API operation) may be a node too, published by a lint plugin through the `graphNodes` capability. The boundary is the same one: an artifact node carries its address, its kind, its readable name, and the line it starts on, and never the artifact's content. The graph parses no address and carries no verdict; a coverage, exclusion, or diagnostic fact belongs to the linter, which already delivers it as a compile error. Because those facts come from a plugin's own process, `provenance` names a second producer and `capabilities` lists `artifactNodes` only when the producer asked.

## Prohibited

Do not hardcode fixture names, repository names, model names, prompt text, expected answers, token targets, file names, package names, or tool-call counts. Do not add caps, cooldowns, idle resets, forced first calls, or any control hack that makes Codex, Claude Code, or another real coding agent worse. Never suppress a legitimate agent follow-up to improve a number.

Do not validate answer quality with free-text checks. Matching words, phrases, regexes, or final-response content is hardcoding and benchmark contamination. The harness may record numeric observations such as tokens, tool calls, shell reads, MCP calls, and durations; humans inspect quality.

## Schema And Instruction

MCP returns stay typed and structured. Request and result union members pair as `ITtscGraphX.IRequest` and `ITtscGraphX`. Use short discriminators, clear field comments, and typed decision fields instead of prose-only rules.

Keep the required `question`, `draft`, `review`, and escape path that the README's "Chain of thought" section describes, and do not force graph use when ordinary coding-agent behavior is the right next step.

The MCP instruction's first 512 characters say what the tool is, when to use it, and why compiler-derived graph facts are trustworthy. Keep the instruction readable, concise, non-contradictory, and Markdown-structured. State when to use the graph first, when to answer from returned graph fields, and when to escape for source body text or non-graph evidence.

The audit may claim only facts the server checked. The `next` field may state only what the returned graph establishes; it cannot infer what the question meant or whether identifier text semantically covered it. `RESULT_AUDIT` permits another graph call when `next` says inspect, so a false inspect signal defeats the stop rule, and no instruction may invent a reason to drill.

## Tours

A tour is an index-level overview, not a path-stitching engine. Closures stay out of tours as seeds, reach, and flows because they explode the graph, and seed-to-seed bridges stay out as well.

## Benchmark Prompts

Common prompts remain natural repository-orientation or architecture questions. Dedicated prompts may be project-specific but still plausible. Never append graph-specific hidden guidance to user prompts, and never optimize by making the product worse outside the benchmark.

Optimize in this order: instruction clarity, schema clarity, graph result quality, then tool-shape reduction only if the removed shape is not generally useful. Treat negative savings as a trace-analysis signal, not a reason to add benchmark-only logic.

## Measuring A Change

Any change to graph logic, the instruction, the schema, a tool description, or runner text requires every `ttsc-graph` cell across all repositories, models, and both prompt families to be re-measured and compared with the published `graph.json`. The [benchmark skill's graph procedure](../benchmark/graph.md) runs and audits those cells.

1. **Compute the blast radius first.** Ranking changes propagate through the whole tour: seed order changes flows, which change nearby nodes, tests, and anchors. Before spending model tokens, run the old and new tours offline for every repository and prompt-family cell, diff the payloads, and predict the effect on every changed cell. Byte-identical payloads cannot reflect a server-side change.
2. **Re-measure the whole arm.** Validate cells individually, not by family average. A cell that loses reduction, adds calls, or newly reads files blocks merge until its trace explains the cause and the cause is fixed. Baseline and comparator arms may stand when the changed code cannot affect them.
3. **Treat a surprise as failed understanding.** A single-cell change can alter seed coverage, grow flow payloads, or remove anchors the model cites in another repository. When a result contradicts the prediction, investigate or revert before stacking another patch.
