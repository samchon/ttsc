import assert from "node:assert/strict";

/**
 * Observes native self-call omission and terminal/midchain edges in the shared
 * graph.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual MCP details retain the recursive source node without a self-call edge, preserve a separate moving call, and deliver the terminal leaf, midchain flush and twelve distinct callers for both hubs.
 * @evidence contracts/testing.md#independent-expectations Independently authored names and literal twelve-caller topology prescribe each expected edge, without taking a query result as its own expected graph.
 * @evidence contracts/testing.md#distinguishing-cases A retained self-recursive node has no outgoing self-call, while a separate caller retains its moving edge; the terminal leaf differs from the equally high-fan-in node with an outgoing flush call.
 * @evidence contracts/testing.md#execution-ownership The existing initialized graph client makes one multi-handle details request. No preparation, producer, process or native profile is launched here.
 * @evidence contracts/e2e.md#necessary-boundary Native extraction and MCP delivery must connect authored source edges to actual query facts; source-owned tour units separately own closed-universe selection and comparison.
 * @evidence contracts/e2e.md#shared-execution All nodes enter the same upfront graph population, before its initial snapshot. A single request borrows the same resident session.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This helper only reads the current immutable graph and leaves client lifetime and later transitions to its caller.
 * @evidence contracts/e2e.md#preserved-coverage Closed-universe terminal tour and recursion-first/nonrecursive equality belong to their exact direct units; packages/ttsc/internal/graph/value_call_edges_skip_self_and_unresolved_test.go::TestValueCallEdgesSkipSelfAndUnresolved owns actual extractor self/unresolved omission versus a resolved positive. This oracle owns native node/edge acquisition and MCP projection rather than claiming global tour ranking is unchanged by unrelated population members.
 */
export async function assertGraphTourInputCorpus(client: {
  request(method: string, params: unknown): Promise<unknown>;
}): Promise<void> {
  const callers = Array.from(
    { length: 12 },
    (_, index) => "NativeTerminalCaller" + index,
  );
  const response = (await client.request("tools/call", {
    name: "inspect_typescript_graph",
    arguments: {
      question:
        "Inspect the native self edge, moving edge and two high-fan-in terminal boundaries.",
      draft: {
        reason:
          "Read native self-call omission and resolved source edges in one graph.",
        type: "details",
      },
      review: "Keep all independent handles in this shared details request.",
      request: {
        type: "details",
        handles: [
          "NativeSelfSeed",
          "NativeMovingSeed",
          "NativeTerminalWrite",
          "NativeCommit",
          ...callers,
        ],
      },
    },
  })) as {
    structuredContent?: {
      result?: {
        nodes?: {
          name: string;
          calls?: { name: string }[];
          dependedOnBy?: { name: string }[];
        }[];
      };
    };
  };
  const nodes = response.structuredContent?.result?.nodes;
  assert.ok(Array.isArray(nodes));
  const node = (name: string) => {
    const value = nodes.find((row) => row.name === name);
    assert.ok(value, name);
    return value;
  };
  assert.deepEqual(
    node("NativeSelfSeed").calls ?? [],
    [],
    "native extraction retains the declaration and omits its self-call",
  );
  assert.ok(
    node("NativeMovingSeed").calls?.some(
      (row) => row.name === "NativeMovingWork",
    ),
  );
  assert.deepEqual(node("NativeTerminalWrite").calls ?? [], []);
  assert.ok(
    node("NativeCommit").calls?.some((row) => row.name === "NativeFlush"),
  );
  for (const name of callers)
    assert.deepEqual(
      node(name)
        .calls?.map((row) => row.name)
        .sort(),
      ["NativeCommit", "NativeTerminalWrite"],
    );
}
