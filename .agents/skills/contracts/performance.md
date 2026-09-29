# Work And Resource Costs

Apply to operations whose repeated work or retained state can affect product latency, throughput, or resource use: compiler and graph traversal, transform delivery and validation, project walks, watchers, worker coordination, printing, and browser package loading. A configuration field or constant does not independently establish the cost of the operation using it.

Existing cost contracts include [Metro's shared compile](../../../packages/metro/README.md#caveats-v1), [terminal-generation reuse](../../../packages/unplugin/src/core/transform/cache/replaysTerminalGeneration.ts), [bounded fallback polling](../../../packages/unplugin/src/core/observer/createInputObserver.ts), and [graph edge deduplication](../../../packages/ttsc/internal/graph/edges.go). These are different mechanisms and promises; apply the one the operation owns. Benchmark workloads and measurement integrity remain owned by the [benchmark skill](../benchmark/SKILL.md#measurement-integrity).

## Account for work and retained resources

Identify the quantities that drive the operation's work, such as input files and bytes, graph nodes and edges, delivered modules, requests, workers, or edits. State the relevant cost per call and across the enclosing build, request burst, or session. Name expensive work repeated at each boundary and any sharing, batching, or incremental mechanism that avoids repeating it. Explain the invalidation or freshness boundary that makes reuse valid; do not make a faster path correct by assuming inputs cannot change during a queue or shared lifetime.

Where the operation retains watchers, processes, handles, cache entries, or snapshots, identify what bounds their population and when they are released or evicted. Include waiting and synchronization when those dominate latency. A bounded amount of work per polling tick also needs its detection-delay behavior explained as the input population grows.

For a performance repair or an improvement claim, identify the workload, baseline, measured quantity, and result. Keep cold, reused, changed-input, and concurrent cases distinct where they exercise different paths. Verify the relevant correctness and failure behavior too. Link the evidence and state what was not measured; do not describe an unmeasured speedup or an open design proposal as an established result. Ordinary non-performance changes do not each require a new benchmark.

An operation's local cost can be small while repeated whole-project validation makes a build quadratic or blocks every queued request. Sharing work can reduce that cost while serving stale output if the reuse boundary is wrong. Persistent caches and observers can also trade a short benchmark's speed for unbounded resources during a long session.

Use existing product cost promises or an explicitly specified budget. Do not invent a universal constant-time requirement, a numeric latency limit, or a ban on a necessary complete scan. An operation that must scan its inputs explains why, how often, and what prevents multiplication of that scan by unrelated requests.
