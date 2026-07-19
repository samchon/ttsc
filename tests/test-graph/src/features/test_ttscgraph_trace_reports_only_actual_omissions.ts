import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

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
 */
export const test_ttscgraph_trace_reports_only_actual_omissions = async () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          moduleResolution: "node",
          strict: true,
          rootDir: "src",
          outDir: "dist",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "node_modules/trace-dependency/package.json": JSON.stringify({
      name: "trace-dependency",
      version: "1.0.0",
      types: "index.d.ts",
    }),
    "node_modules/trace-dependency/index.d.ts":
      "export declare function externalWork(): void;\n",
    "src/app.ts": [
      'import { externalWork } from "trace-dependency";',
      "",
      "export function shared(): void {}",
      "export function identity(): void { shared(); }",
      "export function disconnected(): void {}",
      "",
      "export function leaf(): void {}",
      "export function leafStart(): void { leaf(); }",
      "",
      "export function chainTail(): void {}",
      "export function chainMiddle(): void { chainTail(); }",
      "export function chainStart(): void { chainMiddle(); }",
      "",
      "export function reverseRoot(): void { reverseMiddle(); }",
      "export function reverseMiddle(): void { reverseLeaf(); }",
      "export function reverseLeaf(): void {}",
      "",
      "export type TypeOnly = { value: number };",
      "export function typeBoundary(_value: TypeOnly): void {}",
      "export function typeStart(): void { typeBoundary({ value: 1 }); }",
      "",
      "export function externalBoundary(): void { externalWork(); }",
      "export function externalStart(): void { externalBoundary(); }",
      "",
      "export function cycleA(): void { cycleB(); }",
      "export function cycleB(): void { cycleA(); }",
      "",
      "export function crossStart(): void { crossLeft(); crossRight(); }",
      "export function crossLeft(): void { crossRight(); }",
      "export function crossRight(): void {}",
      "",
      "export function exactNode(): void {}",
      "export function exactNodeStart(): void { exactNode(); }",
      "export function overflowNodeA(): void {}",
      "export function overflowNodeB(): void {}",
      "export function overflowNodeStart(): void { overflowNodeA(); overflowNodeB(); }",
      "",
      "export function exactHopStart(): void { exactHopA(); exactHopB(); }",
      "export function exactHopA(): void { exactHopB(); exactHopStart(); }",
      "export function exactHopB(): void {}",
      "",
      "export function overflowHopStart(): void { overflowHopA(); overflowHopB(); }",
      "export function overflowHopA(): void { overflowHopB(); overflowHopStart(); }",
      "export function overflowHopB(): void { overflowHopA(); }",
      "",
      "export namespace First { export function duplicate(): void {} }",
      "export namespace Second { export function duplicate(): void {} }",
      "",
    ].join("\n"),
  });

  const client = TtsgraphClient.start(root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
    });
    client.notify("notifications/initialized", {});

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
  } finally {
    client.endStdin();
  }

  const code = await client.waitForExit();
  assert.equal(
    code,
    0,
    `the launcher exits cleanly\nstderr: ${client.stderrText()}`,
  );
};
