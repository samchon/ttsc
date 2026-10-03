import assert from "node:assert/strict";

import { TtscGraphApplication } from "../../../../packages/graph/src/TtscGraphApplication";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies escape leaves the graph provider untouched while details acquires
 * it.
 *
 * Escape remains useful before graph construction and after a provider failure.
 * The adjacent real operation must acquire the supplied generation and return
 * its declaration facts, rather than treating every request as a graph-free
 * exit.
 *
 * 1. Request escape with absent and present nextStep and require zero provider
 *    calls.
 * 2. Request details and require one provider call and the whole authored result.
 * 3. Reject a subsequent provider request and require another escape to bypass it.
 * 4. Collect every independent observation before reporting named failures.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual source application preserves escape reason/skipped/optional nextStep without calling its public provider seam. Details calls that provider once and returns the independently authored node envelope; a provider rejection propagates by identity, then escape still acquires no graph.
 * @evidence contracts/testing.md#independent-expectations Literal escape fields and an authored class id/name/kind/file define the expected structured results. Explicit provider counters and the independently created failure object distinguish acquisition and error forwarding without copying output from runDetails.
 * @evidence contracts/testing.md#distinguishing-cases Absent versus present nextStep contrasts escape with actual details dispatch. A successful asynchronous provider contrasts its later rejection, and escape remains usable after that rejection. Native compiler facts and MCP lazy process creation remain installed E2E assertions.
 * @evidence contracts/testing.md#execution-ownership The test-graph runner discovers this exported test function and executes TtscGraphApplication plus the existing synthetic-memory helper directly in one Node process. It installs nothing, compiles no native artifact and starts no real host or child.
 */
export async function test_ttscgraph_escape_defers_provider_until_a_real_request(): Promise<void> {
  const graph = createSyntheticGraph([
    {
      id: "src/control.ts#Control:class",
      name: "Control",
      kind: "class",
      file: "src/control.ts",
      external: false,
    },
  ]);
  let providerCalls = 0;
  let rejectProvider = false;
  const providerFailure = new Error("authored provider failure");
  const application = new TtscGraphApplication(async () => {
    providerCalls++;
    if (rejectProvider) throw providerFailure;
    return graph;
  });
  const failures: Error[] = [];
  const observe = async (
    name: string,
    body: () => Promise<void>,
  ): Promise<void> => {
    try {
      await body();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  const escape = async (nextStep?: string): Promise<void> => {
    const before = providerCalls;
    const output = await application.inspect_typescript_graph({
      question: "Use evidence outside the TypeScript declaration graph.",
      draft: { reason: "No graph evidence is requested.", type: "escape" },
      review: "Retain the explicit graph-free request.",
      request: {
        type: "escape",
        reason: "Read the external specification.",
        ...(nextStep === undefined ? {} : { nextStep }),
      },
    });
    assert.deepEqual(output.result, {
      type: "escape",
      skipped: true,
      reason: "Read the external specification.",
      ...(nextStep === undefined ? {} : { nextStep }),
    });
    assert.equal(output.next.action, "outside");
    assert.equal(providerCalls, before);
  };
  await observe("cold escape without nextStep", () => escape());
  await observe("cold escape with nextStep", () =>
    escape("Read the specification section."),
  );
  await observe("cold provider was never acquired", async () => {
    assert.equal(providerCalls, 0);
  });
  const details = () =>
    application.inspect_typescript_graph({
      question: "Read the declaration identity of Control.",
      draft: {
        reason: "Details is the requested graph operation.",
        type: "details",
      },
      review: "Return the supplied graph's declaration facts.",
      request: { type: "details", handles: ["Control"] },
    });
  await observe("real details acquires the provider", async () => {
    const before = providerCalls;
    const output = await details();
    assert.equal(providerCalls, before + 1);
    assert.deepEqual(output.result, {
      type: "details",
      nodes: [
        {
          id: "src/control.ts#Control:class",
          name: "Control",
          kind: "class",
          file: "src/control.ts",
        },
      ],
      unknown: [],
    });
    assert.equal(output.next.action, "answer");
  });
  rejectProvider = true;
  await observe("real request preserves provider failure", async () => {
    const before = providerCalls;
    await assert.rejects(details(), (error) => error === providerFailure);
    assert.equal(providerCalls, before + 1);
  });
  await observe("escape remains usable after provider failure", () => escape());
  if (failures.length)
    throw new AggregateError(
      failures,
      "Graph escape/provider observations failed",
    );
}
