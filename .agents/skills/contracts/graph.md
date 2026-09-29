# Graph Facts

Apply to graph queries, result audit, artifact ingestion, and snapshot assembly in `packages/graph`, with their native producers in `packages/ttsc/internal/graph`. Viewer styling and unrelated launcher argument parsing do not establish the truth of graph facts.

The product rules remain in [Graph MCP](../project/graph.md). Implementation witnesses include [artifact publication](../../../packages/graph/src/model/publishedArtifacts.ts) and [shard assembly](../../../packages/graph/src/model/TtscGraphShardStore.ts).

## Return facts from the declared producer

Identify the compiler snapshot or plugin producer behind the returned fact and the typed field that conveys it. Explain source-span handling without embedding implementation bodies, and retain artifact provenance without interpreting its citation address or inventing an evidence verdict.

For a result audit, identify what the returned graph actually establishes. For snapshot assembly, identify generation and manifest validation and when the complete candidate becomes visible. Answer for the operation's role rather than making every graph declaration claim it assembles transactions.

An invented audit conclusion can send an agent on an unsupported follow-up. Mixing shards from different generations can produce internally plausible facts that never coexisted in one compiler snapshot.
