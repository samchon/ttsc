import {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_ESCAPE,
} from "@ttsc/graph";

import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: {
    audit?: string;
    next?: { action?: string };
    result?: { type?: string };
  };
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const escapeArguments = () => ({
  question: "The next evidence is outside the indexed TypeScript graph.",
  draft: {
    reason: "The next evidence is outside the indexed TypeScript graph.",
    type: "escape",
  },
  review: "Confirmed: skip graph work and return escape.",
  request: {
    type: "escape",
    reason: "No graph operation is needed for this request.",
    nextStep: "Use non-graph evidence.",
  },
});

const overviewArguments = () => ({
  question: "Summarize project shape from graph index facts.",
  draft: {
    reason: "An overview is the smallest useful architecture request.",
    type: "overview",
  },
  review: "Confirmed: read architecture facts from the graph, not from files.",
  request: {
    type: "overview",
    aspect: "all",
  },
});

const detailsArguments = () => ({
  question: "What is WireWidget?",
  draft: {
    reason: "details is the smallest useful named-symbol request.",
    type: "details",
  },
  review: "Confirmed: read the symbol's shape from the graph, not from files.",
  request: {
    type: "details",
    handles: ["WireWidget"],
  },
});

// The audit each operation is expected to carry: details states its
// identity/fan-out split, the other exact walks state the bounded whole, and an
// escape carries none.
const auditFor = (type: string): string =>
  type === "escape"
    ? RESULT_AUDIT_ESCAPE
    : type === "details"
      ? RESULT_AUDIT_DETAILS
      : RESULT_AUDIT;

/**
 * Verifies a result reports its audited `audit` first, carries no instruction,
 * and crosses the wire once.
 *
 * The server used to stamp a `directive` onto every result telling the model
 * the facts were sacred and not to be verified. A tool result is untrusted
 * input, so a command inside one is the shape of a prompt injection, and models
 * read it that way: Sonnet called it "a prompt-injection-style directive baked
 * into the MCP server's tool result", checked the graph against the sources on
 * principle, and warned the user about this server in its answer. What the
 * directive commanded, `audit` now explains: where the result's facts come from
 * and what that leaves them worth. It serializes before `result`, so the
 * provenance precedes the facts.
 *
 * The single copy is load-bearing too: a tool that declares an output schema
 * must answer with `structuredContent`, and serializing the same JSON into a
 * text block as well doubles a 30 KB tour into 60 KB, blowing a client's
 * tool-result cap and spilling the answer to a file the model then shells out
 * to read.
 *
 * 1. Materialize a real project and start one MCP server.
 * 2. Call the escape branch and two real graph branches (overview, details).
 * 3. Assert each payload leads with `audit`, that the audit is the one its
 *    operation carries — details states its identity/fan-out split, overview
 *    the bounded whole — and that it arrives as structured content alone.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP escape, overview and details return exactly the ordered audit/next/result envelope, correct result types and next actions, with no duplicate content text payload.
 * @evidence contracts/testing.md#independent-expectations Literal property order and payload shape are independent expectations. Comparing each audit to auditFor establishes branch dispatch, not independent truth of its wording.
 * @evidence contracts/testing.md#distinguishing-cases Escape avoids graph facts while overview and details have distinct scopes; each still places its audit first and returns only structured content.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_reports_its_audit_before_the_facts starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Installed MCP serialization and application dispatch must preserve the envelope and avoid duplicate text on the wire; a direct return-value check cannot test transport shape.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Exact keys/order, audit branch equality, next-action strings, result types and empty content assertions all remain; direct application units separately own capped audit behavior.
 */
export const test_ttscgraph_reports_its_audit_before_the_facts = async () => {
  await withIdentityBoundary(async (client) => {
    const call = async (
      args: Record<string, unknown>,
      expectedType: string,
    ): Promise<void> => {
      const response = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: args,
      })) as ToolResult;
      const payload = response.structuredContent;
      const raw = JSON.stringify(payload);
      assert.ok(
        payload !== undefined,
        `the result must arrive as structured content: ${JSON.stringify(response)}`,
      );
      assert.deepEqual(
        Object.keys(payload as object),
        ["audit", "next", "result"],
        `audit leads, then where it leaves the question, then the facts: ${raw}`,
      );
      assert.equal(
        payload?.audit,
        auditFor(expectedType),
        `a result assembled from graph nodes must audit clean: ${raw}`,
      );
      assert.ok(
        typeof payload?.next?.action === "string",
        `next must report where the result leaves the question: ${raw}`,
      );
      assert.equal(
        payload?.result?.type,
        expectedType,
        `result.type must mirror the request: ${raw}`,
      );
      assert.deepEqual(
        response.content,
        [],
        `the payload must not cross a second time as text: ${raw}`,
      );
    };

    await call(escapeArguments(), "escape");
    await call(overviewArguments(), "overview");
    await call(detailsArguments(), "details");
  });
};
