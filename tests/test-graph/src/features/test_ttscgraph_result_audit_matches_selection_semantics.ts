import { RESULT_AUDIT, RESULT_AUDIT_SELECTION } from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

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
  draft: { reason: "The smallest useful graph step.", type: props.request.type },
  review: "Confirmed: keep this request; answer from graph facts.",
  request: props.request,
});

/**
 * Verifies each operation's `audit` matches how its result was actually
 * selected: the ranked shortlists (`lookup`, `entrypoints`, `tour`) declare the
 * selection audit, while the exact operations (`trace`, `details`, `overview`)
 * declare the strong fact-verification audit.
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
 *    ranking/truncation metadata that justifies it, and the exact branches
 *    carry {@link RESULT_AUDIT}, and that the two audits are distinct.
 */
export const test_ttscgraph_result_audit_matches_selection_semantics =
  async (): Promise<void> => {
    // A shared `helper` reached from twenty exported `handlerN` functions: a
    // broad "handler" query overflows every ranker's per-file cap and limit, so
    // the shortlist is genuinely scored, bounded, and truncated.
    const handlers = Array.from(
      { length: 20 },
      (_unused, i) =>
        `export function handler${i}(): void { helper(); log(); }`,
    ).join("\n");
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
        },
        include: ["src"],
      }),
      "src/app.ts": [
        "export function helper(): void {}",
        "export function log(): void {}",
        handlers,
        "export class Service {",
        "  run(): void {",
        "    helper();",
        "    handler0();",
        "  }",
        "}",
        "",
      ].join("\n"),
      "src/app.spec.ts": [
        "import { Service } from './app';",
        "export function coversRun(): void { new Service().run(); }",
        "",
      ].join("\n"),
    });

    assert.notEqual(
      RESULT_AUDIT,
      RESULT_AUDIT_SELECTION,
      "the exact and selection audits must be distinct constants",
    );

    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

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
      const hits = (lookup.structuredContent?.result?.hits ??
        []) as { name: string; score: number }[];
      assert.ok(
        hits.length >= 2 &&
          hits.every((hit) => typeof hit.score === "number"),
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
        query: "handler helper log",
        limit: 8,
        neighbors: 1,
      });
      assert.equal(
        entrypoints.structuredContent?.audit,
        RESULT_AUDIT_SELECTION,
        `entrypoints is a ranked shortlist and must carry the selection audit: ${JSON.stringify(entrypoints.structuredContent)}`,
      );
      const epHits = (entrypoints.structuredContent?.result?.hits ??
        []) as { score: number }[];
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
        reinterpretations: ["handler0", "helper", "Service.run"],
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

      const details = await call({ type: "details", handles: ["Service.run"] });
      assert.equal(
        details.structuredContent?.audit,
        RESULT_AUDIT,
        `details resolves named handles and must carry the exact audit: ${JSON.stringify(details.structuredContent)}`,
      );

      const overview = await call({ type: "overview", aspect: "all" });
      assert.equal(
        overview.structuredContent?.audit,
        RESULT_AUDIT,
        `overview reports project structure and must carry the exact audit: ${JSON.stringify(overview.structuredContent)}`,
      );
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(
      code,
      0,
      `the launcher should exit cleanly\nstderr: ${client.stderrText()}`,
    );
  };
