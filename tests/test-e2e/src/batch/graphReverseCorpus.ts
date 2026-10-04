import assert from "node:assert/strict";
type Client = { request(method: string, params: unknown): Promise<unknown> };
interface ToolResult { structuredContent?: { result?: TraceResult } }
interface TraceResult {
  type: "trace";
  start?: { id: string; name: string; file: string };
  hops: { from: string; to: string; kind: string; depth: number }[];
  reached: { id: string; name: string; roles?: string[] }[];
  truncated: boolean;
}
const HUB_IMPLEMENTATIONS = 12;
/**
 * Consumes the reverse-dispatch population through the existing native snapshot.
 * @evidence contracts/testing.md#behavioral-verification Actual reverse/impact walks cross valid checker seams and expose caller roles, cycles, hub omissions and exact depth limits with the original independent negative controls.
 * @evidence contracts/testing.md#independent-expectations Literal caller/method names, incompatible string versus number signatures and twelve authored hub implementations determine all expected inclusions and exclusions before querying.
 * @evidence contracts/testing.md#distinguishing-cases Forward/reverse/impact, execution/all/types, abstract overrides, external inclusion, unrelated methods, rejected implementations and twelve-way hubs distinguish independent graph decisions.
 * @evidence contracts/testing.md#execution-ownership The existing graph entry calls this assertion once with its resident client; every query is readonly and no launcher, prepare, compiler or Program is constructed here.
 * @evidence contracts/e2e.md#necessary-boundary Actual native checker extraction and MCP traversal must agree on valid and rejected member relations; an invented graph cannot supply these observations.
 * @evidence contracts/e2e.md#shared-execution One upfront graph-stage population joins the existing graph native snapshot before its first native request. Independent query loops do not execute separate hosts or Programs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Authored paths and Reverse-prefixed contracts isolate this population. No source/config edits occur after the native snapshot starts; the caller closes its actual session.
 * @evidence contracts/e2e.md#preserved-coverage Retains every original reverse/impact, role, cycle, external, hub, depth, types and forward assertion without invoking the former identity preparation or raw dump.
 */
export async function assertGraphReverseCorpus(client: Client): Promise<void> {
      const call = async (
        request: Record<string, unknown>,
      ): Promise<TraceResult> => {
        const response = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: {
            question: "What does changing this implementation reach?",
            draft: {
              reason: "A trace is the smallest step for a blast radius.",
              type: "trace",
            },
            review: "Confirmed: answer from the trace's graph facts.",
            request: { type: "trace", ...request },
          },
        })) as ToolResult;
        const trace = response.structuredContent?.result;
        assert.equal(
          trace?.type,
          "trace",
          `expected a trace result: ${JSON.stringify(response)}`,
        );
        return trace!;
      };

      const names = (trace: TraceResult): string[] =>
        trace.reached.map((node) => node.name);
      const dispatchHops = (trace: TraceResult): number =>
        trace.hops.filter((hop) => hop.kind === "dispatches").length;

      for (const direction of ["reverse", "impact"]) {
        for (const focus of ["execution", "all"]) {
          const crossed = await call({
            from: "ReverseGood.execute",
            direction,
            focus,
            maxDepth: 4,
            maxNodes: 12,
          });
          const reached = names(crossed);
          for (const expected of ["ReversePipeline.execute", "ReverseRunner.run", "main"])
            assert.ok(
              reached.includes(expected),
              `${direction}/${focus} crosses the seam to ${expected}: ${reached.join(", ")}`,
            );
          assert.ok(
            dispatchHops(crossed) > 0,
            `${direction}/${focus} records the crossing as a dispatches hop: ${JSON.stringify(crossed.hops)}`,
          );
        }
      }

      const impact = await call({
        from: "ReverseGood.execute",
        direction: "impact",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 16,
      });
      assert.ok(
        impact.reached
          .find((node) => node.name === "main")
          ?.roles?.includes("exported"),
        `impact tags the public surface it now reaches: ${JSON.stringify(impact.reached)}`,
      );
      assert.ok(
        impact.reached.some((node) => node.roles?.includes("test")),
        `impact tags the test that exercises the newly reached callers: ${JSON.stringify(impact.reached)}`,
      );

      const abstractOverride = await call({
        from: "RealTask.perform",
        direction: "reverse",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      const overrideReached = names(abstractOverride);
      for (const expected of ["ReverseTask.perform", "startTask"])
        assert.ok(
          overrideReached.includes(expected),
          `an abstract-method override crosses back to ${expected}: ${overrideReached.join(", ")}`,
        );
      const signatures = abstractOverride.hops.map(
        (hop) => `${hop.from}|${hop.to}|${hop.kind}`,
      );
      assert.equal(
        signatures.length,
        new Set(signatures).size,
        `a cycle through an implementation and its base records no duplicate hop: ${signatures.join(", ")}`,
      );

      const invalid = await call({
        from: "ReverseBad.execute",
        direction: "reverse",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.ok(
        !names(invalid).includes("ReversePipeline.execute"),
        `a checker-rejected member stays disconnected in reverse: ${names(invalid).join(", ")}`,
      );

      const unrelated = await call({
        from: "Alone.solo",
        direction: "reverse",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.deepEqual(
        names(unrelated),
        ["callSolo"],
        "a method with no member relation reverses exactly as before",
      );

      const externalFiltered = await call({
        from: "Settlement",
        direction: "reverse",
        focus: "all",
        includeExternal: false,
        maxDepth: 2,
        maxNodes: 12,
      });
      assert.ok(
        !names(externalFiltered).includes("Contract"),
        `an external declaration stays filtered in reverse: ${names(externalFiltered).join(", ")}`,
      );
      const externalIncluded = await call({
        from: "Settlement",
        direction: "reverse",
        focus: "all",
        includeExternal: true,
        maxDepth: 2,
        maxNodes: 12,
      });
      assert.ok(
        names(externalIncluded).includes("Contract"),
        `the same endpoint is reached when externals are eligible: ${names(externalIncluded).join(", ")}`,
      );

      const hubForward = await call({
        from: "paint",
        direction: "forward",
        focus: "execution",
        maxDepth: 3,
        maxNodes: 16,
      });
      assert.equal(hubForward.start?.name, "paint");
      assert.equal(hubForward.start?.file, "src/reverse.ts");
      assert.ok(hubForward.start?.id, "forward hub control must resolve its authored start");
      assert.equal(
        dispatchHops(hubForward),
        0,
        `a hub declaration stays a leaf going forward: ${JSON.stringify(hubForward.hops)}`,
      );
      const hubReverse = await call({
        from: "ReverseWidget0.draw",
        direction: "reverse",
        focus: "execution",
        maxDepth: 3,
        maxNodes: 16,
      });
      assert.equal(hubReverse.start?.name, "ReverseWidget0.draw");
      assert.equal(hubReverse.start?.file, "src/reverse.ts");
      assert.ok(hubReverse.start?.id, "reverse hub control must resolve its authored implementation");
      assert.equal(
        dispatchHops(hubReverse),
        0,
        `reverse applies the same hub policy: ${JSON.stringify(hubReverse.hops)}`,
      );

      const bounded = await call({
        from: "ReverseGood.execute",
        direction: "reverse",
        focus: "execution",
        maxDepth: 1,
        maxNodes: 12,
      });
      assert.deepEqual(
        names(bounded),
        ["ReversePipeline.execute"],
        "the depth bound governs the synthesized edge like any other",
      );
      assert.equal(
        bounded.truncated,
        true,
        "and the omission beyond that bound is reported",
      );

      const typed = await call({
        from: "ReverseGood.execute",
        direction: "reverse",
        focus: "types",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.equal(
        dispatchHops(typed),
        0,
        `\`focus: "types"\` reverse is unchanged: ${JSON.stringify(typed.hops)}`,
      );

      const forward = await call({
        from: "ReverseRunner.run",
        direction: "forward",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.ok(
        names(forward).includes("ReverseGood.execute") &&
          names(forward).includes("Reverseaccepted"),
        `the forward direction is unchanged: ${names(forward).join(", ")}`,
      );

}
