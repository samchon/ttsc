import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  structuredContent?: {
    next?: { action?: string };
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
  truncated: boolean;
  path?: { id: string; name: string }[];
  steps?: string[];
  junctions?: unknown[];
  candidates?: { id: string; name: string }[];
}

const graphArguments = (request: Record<string, unknown>) => ({
  question: "Which represented flow does this trace prove?",
  draft: {
    reason: "Trace is the smallest graph operation for this flow boundary.",
    type: "trace",
  },
  review: "Confirmed: keep the trace and answer from its graph facts.",
  request,
});

/**
 * Verifies graph traces report success and truncation from represented facts,
 * not merely from a zero hop count or reaching a configured depth boundary.
 *
 * A self path has no hops by definition, while an open trace at `maxDepth` can
 * be complete when its boundary is a leaf or has only policy-filtered edges.
 * Conversely, a back/cross edge to an already represented node is still omitted
 * content when its hop is absent. This case locks those distinctions together
 * with the independent node and hop caps, because all of them feed the same
 * `next` and `truncated` completeness contract used by graph callers.
 *
 * 1. Materialize leaf, chain, filtered, cyclic, cross-edge, cap, identity, and
 *    ambiguous-handle shapes in one resident compiler graph.
 * 2. Trace each shape through the real MCP launcher in forward, reverse, impact,
 *    execution, all-edge, external-excluded, and external-included modes.
 * 3. Assert success for zero-hop identity paths and truncation only when an
 *    otherwise eligible node or hop is actually absent from the response.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP trace reports truncation only for eligible omitted graph, across exact/overflow depth, node and hop limits, focus/external filtering and cycles; identity, disconnection and ambiguity retain distinct actions.
 * @evidence contracts/testing.md#independent-expectations Literal fixture chains and caps independently distinguish exhausted output from an unseen continuation; identity requires one path node and no hops/steps.
 * @evidence contracts/testing.md#distinguishing-cases Forward/reverse/impact leaf versus continuing chain, execution versus all, external exclusion/inclusion, cycles, exact node/hop counts and ambiguous start/target exercise the owned boundaries.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_trace_reports_only_actual_omissions borrows the shared workspace-built MCP launcher and explicitly selected real native session, not a consumer-local packed SDK installation and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native call/type/external identities and MCP next-action/truncation assembly must agree; a predicate-only proof cannot certify real producer eligibility.
 * @evidence contracts/e2e.md#shared-execution The unchanged omission corpus supplies identity/ambiguity/disconnection, directional chains, focus/external eligibility, cycles and exact/overflow node/hop requests through one identity MCP/native session. Actual responses supply next/truncation controls, not neighboring cached CLI facts. Client/input reuse does not certify Program objects, construction counts or packed installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage All original identity, ambiguity, disconnection, focus/external, cycle, node/hop and exact-versus-overflow assertions are preserved, including both truncation outcomes.
 */
export const case_ttscgraph_trace_reports_only_actual_omissions = async () => {
  await withIdentityBoundary(async (client) => {
    const call = async (
      request: Record<string, unknown>,
    ): Promise<NonNullable<ToolResult["structuredContent"]>> => {
      const response = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({ type: "trace", ...request }),
      })) as ToolResult;
      assert.equal(
        response.structuredContent?.result?.type,
        "trace",
        `expected a trace result: ${JSON.stringify(response)}`,
      );
      return response.structuredContent!;
    };

    const identity = await call({ from: "identity", to: "identity" });
    assert.deepEqual(
      identity.result!.path?.map((node) => node.name),
      ["identity"],
      "a self trace returns its one-node identity path",
    );
    assert.deepEqual(identity.result!.hops, [], "a self path has zero hops");
    assert.deepEqual(identity.result!.steps, [], "a self path has zero steps");
    assert.equal(
      identity.result!.junctions,
      undefined,
      "a found self path does not search for junctions",
    );
    assert.equal(
      identity.next?.action,
      "answer",
      "zero-hop path existence, not hop count, selects the next action",
    );

    const disconnected = await call({
      from: "identity",
      to: "disconnected",
      focus: "execution",
    });
    assert.equal(
      disconnected.next?.action,
      "outside",
      "distinct disconnected nodes preserve the no-path result",
    );

    const ambiguousStart = await call({ from: "duplicate", to: "duplicate" });
    assert.ok(
      (ambiguousStart.result!.candidates?.length ?? 0) >= 2,
      "an ambiguous start still returns candidates",
    );
    assert.equal(ambiguousStart.next?.action, "clarify");
    const ambiguousTarget = await call({ from: "identity", to: "duplicate" });
    assert.ok(
      (ambiguousTarget.result!.candidates?.length ?? 0) >= 2,
      "an ambiguous target still returns candidates",
    );
    assert.equal(ambiguousTarget.next?.action, "inspect");

    for (const request of [
      { from: "leafStart", direction: "forward" },
      { from: "leaf", direction: "reverse" },
      { from: "leaf", direction: "impact" },
    ]) {
      const complete = await call({
        ...request,
        focus: "execution",
        maxDepth: 1,
        maxNodes: 8,
      });
      assert.equal(
        complete.result!.truncated,
        false,
        `${request.direction} leaf at maxDepth is complete`,
      );
    }

    for (const request of [
      { from: "chainStart", direction: "forward" },
      { from: "reverseLeaf", direction: "reverse" },
      { from: "reverseLeaf", direction: "impact" },
    ]) {
      const omitted = await call({
        ...request,
        focus: "execution",
        maxDepth: 1,
        maxNodes: 8,
      });
      assert.equal(
        omitted.result!.truncated,
        true,
        `${request.direction} eligible continuation beyond maxDepth is omitted`,
      );
    }

    const focusFiltered = await call({
      from: "typeStart",
      direction: "forward",
      focus: "execution",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      focusFiltered.result!.truncated,
      false,
      "a type-only boundary edge filtered from execution focus is not omitted",
    );
    const focusEligible = await call({
      from: "typeStart",
      direction: "forward",
      focus: "all",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      focusEligible.result!.truncated,
      true,
      "the same boundary edge truncates when the selected focus includes it",
    );

    const externalFiltered = await call({
      from: "externalStart",
      direction: "forward",
      focus: "execution",
      includeExternal: false,
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      externalFiltered.result!.truncated,
      false,
      "an excluded external boundary is intentional filtering",
    );
    const externalEligible = await call({
      from: "externalStart",
      direction: "forward",
      focus: "execution",
      includeExternal: true,
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      externalEligible.result!.truncated,
      true,
      "the same external boundary truncates when externals are eligible",
    );

    const cycleOmitted = await call({
      from: "cycleA",
      focus: "execution",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      cycleOmitted.result!.truncated,
      true,
      "an omitted back-edge hop is content even when its node is represented",
    );
    const cycleRepresented = await call({
      from: "cycleA",
      focus: "execution",
      maxDepth: 2,
      maxNodes: 8,
    });
    assert.equal(cycleRepresented.result!.hops.length, 2);
    assert.equal(
      cycleRepresented.result!.truncated,
      false,
      "a represented cycle has no omitted continuation",
    );

    const crossOmitted = await call({
      from: "crossStart",
      focus: "execution",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      crossOmitted.result!.truncated,
      true,
      "an omitted cross-edge hop is content even when both nodes are represented",
    );
    const crossRepresented = await call({
      from: "crossStart",
      focus: "execution",
      maxDepth: 2,
      maxNodes: 8,
    });
    assert.equal(crossRepresented.result!.hops.length, 3);
    assert.equal(crossRepresented.result!.truncated, false);

    const exactNodes = await call({
      from: "exactNodeStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 1,
    });
    assert.equal(exactNodes.result!.reached.length, 1);
    assert.equal(exactNodes.result!.truncated, false);
    const omittedNode = await call({
      from: "overflowNodeStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 1,
    });
    assert.equal(omittedNode.result!.reached.length, 1);
    assert.equal(omittedNode.result!.truncated, true);

    const exactHops = await call({
      from: "exactHopStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 2,
    });
    assert.equal(exactHops.result!.hops.length, 4);
    assert.equal(exactHops.result!.truncated, false);
    const omittedHop = await call({
      from: "overflowHopStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 2,
    });
    assert.equal(omittedHop.result!.hops.length, 4);
    assert.equal(omittedHop.result!.truncated, true);
  });
};
