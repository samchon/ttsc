import {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_SELECTION,
} from "@ttsc/graph";

import { withIdentityBoundary } from "../../internal/graph/internal/identityBoundary";
import { assert } from "../../internal/graph/internal/ttsgraph";

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

/**
 * Verifies each operation's `audit` matches how its result was actually
 * selected: the ranked shortlists (`lookup`, `entrypoints`, `tour`) declare the
 * selection audit, the walks from a named handle (`trace`, `overview`) declare
 * the strong fact-verification audit, and `details` declares its own — its
 * result is a complete identity plus a fan-out slice, not one bounded whole.
 *
 * One global audit used to claim every result contained nothing "matched,
 * ranked, guessed, or inferred," was complete, and should not prompt a second
 * call — false for the operations whose purpose is to score, rank, cap per
 * file, and truncate a shortlist against a natural-language question. The
 * compiler can verify each returned fact, but not that a heuristic shortlist
 * covers the question, so telling the caller to stop conflated two guarantees.
 * This case pins each operation's audit to its real selection path, on results
 * that are non-empty, ranked, and truncated, so the two audits cannot drift
 * back into one.
 *
 * 1. Materialize a project where one helper is reached from many exported
 *    handlers, so a broad query yields a ranked, bounded, truncated shortlist.
 * 2. Drive every request branch over MCP.
 * 3. Assert the ranked branches carry {@link RESULT_AUDIT_SELECTION} plus the
 *    ranking/truncation metadata that justifies it, `trace` and `overview`
 *    carry {@link RESULT_AUDIT}, `details` carries {@link RESULT_AUDIT_DETAILS},
 *    and the audits are distinct.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP lookup, entrypoints and tour carry selection audits while trace, details and overview carry their exact/detail scopes; ranked scores, truncation and a real returned trace handle are also checked.
 * @evidence contracts/testing.md#independent-expectations Three contract audit constants must be distinct, and literal score ordering and limit expectations check selection. Equality to those constants proves dispatch, not their independent wording accuracy.
 * @evidence contracts/testing.md#distinguishing-cases Twenty handlers force a shortlist and truncated entrypoints; caller-selected trace identity contrasts ranked lookup/tour and detail/overview operations.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_result_audit_matches_selection_semantics starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual native facts, MCP DTO selection and application audit dispatch must agree at the wire boundary; constants-only tests cannot prove populated requests choose the correct scope.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Distinct constants, ranked scores, bounded hits, entrypoint truncation, real trace start and every operation's original audit equality are retained.
 */
export const test_ttscgraph_result_audit_matches_selection_semantics =
  async (): Promise<void> => {
    assert.equal(
      new Set([RESULT_AUDIT, RESULT_AUDIT_SELECTION, RESULT_AUDIT_DETAILS])
        .size,
      3,
      "the exact, selection, and details audits must be distinct constants",
    );

    await withIdentityBoundary(async (client) => {
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

      const details = await call({ type: "details", handles: ["AuditService.run"] });
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
    });
  };
