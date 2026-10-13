# Graph MCP

[packages/graph/README.md](../../../packages/graph/README.md) explains the tool. These rules bind every change to it.

- The graph is a compiler-derived index: declarations, signatures, relationships, tests, and source spans, never implementation bodies. Artifact nodes from a lint plugin's `graphNodes` carry address, kind, name, and line only; coverage and verdicts stay in the linter.
- Never hardcode fixture, repository, model, file, or package names, prompts, expected answers, or call counts, and never add caps, cooldowns, forced calls, or other controls that make a real agent worse.
- Never judge answer quality by matching text. The harness records numbers (tokens, calls, reads, durations); humans judge quality.
- Keep returns typed, with `ITtscGraphX.IRequest` paired to `ITtscGraphX` and the README's `question`, `draft`, `review`, and escape path. The instruction's first 512 characters say what the tool is, when to use it, and why its facts are trustworthy.
- The audit claims only what the server checked, and `next` states only what the returned graph establishes; a false inspect signal defeats the stop rule.
- Tours are index-level overviews: no closures as seeds, reach, or flows, and no seed-to-seed bridges.
- Benchmark prompts stay natural questions with no hidden graph guidance. Improve instruction clarity, then schema clarity, then result quality, then tool shape.

## Measuring A Change

A change to graph logic, the instruction, the schema, a tool description, or runner text re-measures every `ttsc-graph` cell against the published `graph.json` through the benchmark skill.

1. Diff old and new tours offline for every cell and predict each change before spending model tokens.
2. Judge each cell on its own. A cell that loses reduction, adds calls, or newly reads files blocks merge until its trace explains the cause and the cause is fixed.
3. When a result contradicts the prediction, investigate or revert before adding another patch.
