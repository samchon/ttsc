import assert from "node:assert/strict";

/**
 * Verifies dispatch threshold observations inside the existing native snapshot.
 *
 * Eleven and twelve disjoint implementation populations are authored before
 * the native producer reads the shared graph. No query changes source or starts
 * another producer. Path and open-trace observations consume the same facts.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual MCP open traces return eleven dispatch hops without truncation below the threshold and zero with truncation at it. A target path crosses the smaller fanout; the larger fanout returns an inspect/details continuation, not outside. Its details lists real authored implementations.
 * @evidence contracts/testing.md#independent-expectations Eleven and twelve literal class declarations bracket the documented twelve-implementation cut. Expected hop counts, flags, action/request literals and implementation-name grammar are independent of returned traversal data.
 * @evidence contracts/testing.md#distinguishing-cases Separate HubEleven and HubTwelve declarations preserve threshold contrasts without changing the shared Program. Open traversal and target traversal retain different omission observations; details checks declared names without claiming a complete list.
 * @evidence contracts/testing.md#execution-ownership The graph batch calls this helper with its one initialized client. It issues readonly requests only, retaining each assertion's original identity and collecting failures across observations.
 * @evidence contracts/e2e.md#necessary-boundary Actual checker heritage facts must cross native snapshot transport and built MCP traversal. Portable graph fixtures cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution Both populations and all path/detail/open-trace assertions borrow one immutable native Program and the graph batch's existing resident host; there is no per-population preparation, source write or server.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique declaration names prevent heritage edges crossing populations. Source bytes remain fixed throughout observations and the caller owns actual client close and shared workspace lifetime.
 * @evidence contracts/e2e.md#preserved-coverage Retains both original hub scenes' eleven/zero hops, false/true truncation, path dispatch, zero withheld path, not-outside/inspect/details continuation, fanout reason and bounded real implementation-name assertions with renamed populations.
 */
export async function assertGraphDispatchCorpus(client: {
  request(method: string, params: unknown): Promise<unknown>;
}): Promise<void> {
  type Result = {
    result?: { hops?: { kind: string }[]; truncated?: boolean; nodes?: { implementedBy?: { name?: string }[] }[] };
    next?: { action?: string; request?: string; reason?: string };
  };
  const call = async (request: Record<string, unknown>): Promise<Result> => {
    const response = await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: { question: "How does the authored runner cross its dispatch population?", draft: { reason: "Inspect the same immutable native facts.", type: request.type }, review: "Keep threshold and continuation observations distinct.", request },
    }) as { structuredContent?: Result };
    assert.ok(response.structuredContent);
    return response.structuredContent;
  };
  const failures: Error[] = [];
  const observe = async (name: string, operation: () => Promise<void>): Promise<void> => {
    try { await operation(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  await observe("hub open trace below threshold", async () => {
    const value = await call({ type: "trace", from: "RunnerEleven.run", direction: "forward", focus: "execution", maxDepth: 6, maxNodes: 32 });
    assert.equal(value.result?.hops?.filter((hop) => hop.kind === "dispatches").length, 11);
    assert.equal(value.result?.truncated, false);
  });
  await observe("hub open trace at threshold", async () => {
    const value = await call({ type: "trace", from: "RunnerTwelve.run", direction: "forward", focus: "execution", maxDepth: 6, maxNodes: 32 });
    assert.equal(value.result?.hops?.filter((hop) => hop.kind === "dispatches").length, 0);
    assert.equal(value.result?.truncated, true);
  });
  await observe("hub path below threshold", async () => {
    const value = await call({ type: "trace", from: "RunnerEleven.run", to: "ElevenImpl3.execute", focus: "execution", maxDepth: 6 });
    assert.equal(value.next?.action, "answer");
    assert.ok(value.result?.hops?.some((hop) => hop.kind === "dispatches"));
  });
  await observe("hub path at threshold", async () => {
    const value = await call({ type: "trace", from: "RunnerTwelve.run", to: "TwelveImpl3.execute", focus: "execution", maxDepth: 6 });
    assert.equal(value.result?.hops?.length, 0);
    assert.notEqual(value.next?.action, "outside");
    assert.equal(value.next?.action, "inspect");
    assert.equal(value.next?.request, "details");
    assert.match(value.next?.reason ?? "", /dispatch fanout of 12 or more implementations/);
  });
  await observe("hub continuation details", async () => {
    const value = await call({ type: "details", handles: ["HubTwelve.execute"], dependencyLimit: 4 });
    const listed = (value.result?.nodes?.[0]?.implementedBy ?? []).map((entry) => entry.name ?? "");
    assert.ok(listed.length >= 2);
    for (const name of listed) assert.match(name, /^TwelveImpl(?:\d|1[01])\.execute$/);
  });
  if (failures.length) throw new AggregateError(failures, "Shared dispatch corpus failed");
}
