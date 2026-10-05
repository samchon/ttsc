import {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_ESCAPE,
  RESULT_AUDIT_SELECTION,
} from "@ttsc/graph";
import assert from "node:assert/strict";

type Client = { request(method: string, params: unknown): Promise<unknown> };
/**
 * Compares original audit and wire assertions against one resident snapshot.
 *
 * @evidence contracts/testing.md#behavioral-verification Ranked lookup/entrypoints/tour, lookup-derived trace, details/overview/escape preserve original audits, ranking, bounds, truncation and wire ordering without duplicate text.
 * @evidence contracts/testing.md#independent-expectations Original twenty handlers and literal key ordering prescribe observations; public audit equality checks branch dispatch, not independent truth of the prose.
 * @evidence contracts/testing.md#distinguishing-cases Exact/detail/selection/escape scopes differ on one native population; a returned handler id seeds the exact trace.
 * @evidence contracts/testing.md#execution-ownership The graph batch calls this once with its initialized client. Local groups issue only readonly queries, with no preparation, host or Program creation.
 * @evidence contracts/e2e.md#necessary-boundary Real native extraction, DTO selection and MCP serialization must agree; portable return-value checks do not establish actual wire shape.
 * @evidence contracts/e2e.md#shared-execution All queries read one immutable resident snapshot; no source mutation or producer CLI is invoked.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The caller owns initialization and actual close; these groups retain no mutable resource or configuration transition.
 * @evidence contracts/e2e.md#preserved-coverage Both original audit scenes retain all score/order/limit/truncation/id/audit/key/type/next/content assertions in this same session.
 */
export async function assertGraphReadonlyCorpus(client: Client): Promise<void> {
  await AuditSelection.verify(client);
  await AuditWire.verify(client);
}
namespace AuditSelection {
  const GRAPH_TOOL_NAME = "inspect_typescript_graph";

  interface ToolResult {
    content: { type: string; text: string }[];
    structuredContent?: {
      audit?: string;
      next?: { action?: string; reason?: string };
      result?: { type?: string; [key: string]: unknown };
    };
  }

  type GraphRequest = { type: string; [key: string]: unknown };

  const graphArguments = (props: {
    thinking: string;
    request: GraphRequest;
  }) => ({
    question: props.thinking,
    draft: {
      reason: "The smallest useful graph step.",
      type: props.request.type,
    },
    review: "Confirmed: keep this request; answer from graph facts.",
    request: props.request,
  });

  export async function verify(client: Client): Promise<void> {
    assert.equal(
      new Set([RESULT_AUDIT, RESULT_AUDIT_SELECTION, RESULT_AUDIT_DETAILS])
        .size,
      3,
      "the exact, selection, and details audits must be distinct constants",
    );

    const call = async (request: GraphRequest): Promise<ToolResult> =>
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          thinking: `How does the code around ${request.type} fit together?`,
          request,
        }),
      })) as ToolResult;

    // --- lookup: scored, ranked, capped, limited -> selection audit. ---
    const lookup = await call({ type: "lookup", query: "handler", limit: 3 });
    assert.equal(
      lookup.structuredContent?.audit,
      RESULT_AUDIT_SELECTION,
      `lookup is a ranked shortlist and must carry the selection audit: ${JSON.stringify(lookup.structuredContent)}`,
    );
    const hits = (lookup.structuredContent?.result?.hits ?? []) as {
      name: string;
      score: number;
    }[];
    assert.ok(
      hits.length >= 2 && hits.every((hit) => typeof hit.score === "number"),
      `lookup returns multiple hits each carrying a numeric score: ${JSON.stringify(hits)}`,
    );
    for (let i = 1; i < hits.length; i++) {
      assert.ok(
        hits[i - 1]!.score >= hits[i]!.score,
        `lookup hits are ordered by descending score: ${JSON.stringify(hits)}`,
      );
    }
    assert.ok(
      hits.length <= 3,
      `lookup honors its limit, so the shortlist is bounded (>3 handlers exist): ${JSON.stringify(hits)}`,
    );

    // --- entrypoints: lookup-derived seeds, ranked neighbors, truncation. ---
    const entrypoints = await call({
      type: "entrypoints",
      query: "handler auditHelper log",
      limit: 8,
      neighbors: 1,
    });
    assert.equal(
      entrypoints.structuredContent?.audit,
      RESULT_AUDIT_SELECTION,
      `entrypoints is a ranked shortlist and must carry the selection audit: ${JSON.stringify(entrypoints.structuredContent)}`,
    );
    const epHits = (entrypoints.structuredContent?.result?.hits ?? []) as {
      score: number;
    }[];
    assert.ok(
      epHits.length >= 1 &&
        epHits.every((hit) => typeof hit.score === "number"),
      `entrypoints hits carry numeric scores: ${JSON.stringify(epHits)}`,
    );
    assert.equal(
      entrypoints.structuredContent?.result?.truncated,
      true,
      `a broad entrypoints query overflows the seed bound and reports truncation: ${JSON.stringify(entrypoints.structuredContent?.result)}`,
    );

    // --- tour: ranked seeds, bounded flows -> selection audit. ---
    const tour = await call({
      type: "tour",
      reinterpretations: ["handler0", "auditHelper", "AuditService.run"],
    });
    assert.equal(
      tour.structuredContent?.audit,
      RESULT_AUDIT_SELECTION,
      `tour ranks seeds and walks bounded flows, so it must carry the selection audit: ${JSON.stringify(tour.structuredContent)}`,
    );

    // --- exact operations resolve from an explicit handle/structure. ---
    const traceFrom = hits.find((hit) => hit.name.startsWith("handler"));
    assert.ok(
      traceFrom !== undefined,
      `a lookup hit is available to seed the trace: ${JSON.stringify(hits)}`,
    );
    const traceId = (
      lookup.structuredContent?.result?.hits as { id: string; name: string }[]
    ).find((hit) => hit.name === traceFrom.name)!.id;

    const trace = await call({
      type: "trace",
      from: traceId,
      direction: "forward",
      focus: "execution",
    });
    assert.equal(
      trace.structuredContent?.audit,
      RESULT_AUDIT,
      `trace walks from an explicit handle and must carry the exact audit: ${JSON.stringify(trace.structuredContent)}`,
    );

    const details = await call({
      type: "details",
      handles: ["AuditService.run"],
    });
    assert.equal(
      details.structuredContent?.audit,
      RESULT_AUDIT_DETAILS,
      `details resolves a named handle into a complete identity and a fan-out slice, so it carries its own audit: ${JSON.stringify(details.structuredContent)}`,
    );

    const overview = await call({ type: "overview", aspect: "all" });
    assert.equal(
      overview.structuredContent?.audit,
      RESULT_AUDIT,
      `overview reports project structure and must carry the exact audit: ${JSON.stringify(overview.structuredContent)}`,
    );
  }
}

namespace AuditWire {
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
    review:
      "Confirmed: read architecture facts from the graph, not from files.",
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
    review:
      "Confirmed: read the symbol's shape from the graph, not from files.",
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

  export async function verify(client: Client): Promise<void> {
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
  }
}
