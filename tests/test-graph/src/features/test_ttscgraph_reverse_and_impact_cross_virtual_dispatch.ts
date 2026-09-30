import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

interface ToolResult {
  structuredContent?: {
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string; depth: number }[];
  reached: { id: string; name: string; roles?: string[] }[];
  truncated: boolean;
}

/** The twelve-implementation cut `dispatchEdges` treats as a hub, not a flow. */
const HUB_IMPLEMENTATIONS = 12;

/**
 * Verifies a reverse or impact trace crosses virtual dispatch the same way a
 * forward trace does, under the forward direction's own eligibility and hub
 * policy.
 *
 * Dispatch was synthesized on the forward side only, so an impact query on a
 * concrete implementation reached neither the declaration it implements nor any
 * caller resolved to that declaration, and reported `truncated: false` while
 * doing it. That is the query an agent runs before changing a method, and the
 * omission compounds: the base's callers, their callers, the exported surface,
 * and the tests that exercise them all go missing at once. The checker relation
 * is oriented implementation-to-base, so both halves of the path sit one step
 * away in a direction reverse traversal does not take.
 *
 * 1. Materialize an interface with a checker-valid and a checker-rejected
 *    implementation, an abstract base whose override closes a cycle, an
 *    unrelated method, an external heritage leaf, and a twelve-implementation
 *    hub.
 * 2. Issue reverse and impact traces from the implementations through the real MCP
 *    launcher, plus the forward and `focus: "types"` controls.
 * 3. Assert the valid seam is crossed in reverse with roles tagged, that the
 *    rejected pair, the external endpoint, and the hub stay governed by the
 *    forward policy, and that bounds and cycles behave as before.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP reverse/impact traversal crosses valid dispatch to ReversePipeline, ReverseRunner and main, carries public/test roles, deduplicates cyclic seams and excludes incompatible/unrelated/hub/type-only paths.
 * @evidence contracts/testing.md#independent-expectations Authored valid and invalid implementations, literal caller names, roles, depth bound and twelve-way hub define expected inclusions and exclusions independently of traversal output.
 * @evidence contracts/testing.md#distinguishing-cases Execution/all focus, abstract overrides, invalid ReverseBad, unrelated solo, external inclusion, hub suppression, depth one and types-only walks distinguish the reverse seam; forward ReverseGood remains a control.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_reverse_and_impact_cross_virtual_dispatch starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native checker implementation relations and original edge direction must survive transport for reverse/impact consumers; hand-built reverse edges cannot certify checker eligibility.
 * @evidence contracts/e2e.md#shared-execution Twenty-eight native graph entries share one project: twenty-five borrow an initialized MCP/native session, and four immutable producer assertions borrow one cached public CLI dump (the checker case uses both). Raw-only selections prepare no MCP client. Closed MCP/tag source scopes preserve original ranking/query universes; named edits advance actual generations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, chains and citation targets preserve distinctions; spec/test roles, decorators, exact/wildcard aliases, real external declarations and a physical workspace link remain. MCP/tag scopes and invalid-config recovery restore config bytes finally. The cached CLI dump serves only unchanged producer assertions; serial MCP requests synchronize named edits, and suite finally joins its owned client after full collection.
 * @evidence contracts/e2e.md#preserved-coverage Original caller identities (with fixture collision renames), dispatch edges, roles, hop uniqueness, all negative exclusions, external policy, truncation and forward control assertions remain intact.
 */
export const test_ttscgraph_reverse_and_impact_cross_virtual_dispatch =
  async () => {
    await withIdentityBoundary(async (client) => {
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
      assert.equal(
        dispatchHops(hubForward),
        0,
        `a hub declaration stays a leaf going forward: ${JSON.stringify(hubForward.hops)}`,
      );
      const hubReverse = await call({
        from: "Widget0.draw",
        direction: "reverse",
        focus: "execution",
        maxDepth: 3,
        maxNodes: 16,
      });
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
    });
  };
