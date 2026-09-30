import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { name: string }[];
}

interface DetailsResult {
  type: "details";
  nodes: {
    name: string;
    calls?: { name: string; relation: string }[];
    types?: { name: string; relation: string }[];
    dependsOn?: { name: string; relation: string }[];
    dependedOnBy?: { name: string; relation: string }[];
  }[];
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const resultOf = <T extends { type: string }>(
  result: ToolResult,
  type: string,
): T => {
  const value = (result.structuredContent ?? {}) as { result?: T };
  if (value.result?.type !== type)
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/**
 * Verifies a documentation link is a traversable relation under the full focus
 * and under neither of the narrowed ones.
 *
 * A `{@link}` the checker resolves is a compiler fact, so it belongs in the
 * graph — but it is neither execution nor a type position, and a consumer that
 * asked for one of those and received a documentation mention would be told a
 * flow runs through prose. The narrowed focuses are therefore the load-bearing
 * assertions here: the positive one only proves the edge exists.
 *
 * 1. Materialize a project whose function cites a type in documentation, calls
 *    another function, and names a third type in its signature.
 * 2. Trace it under each focus.
 * 3. Assert the documentation target is reached under `all` only, while the call
 *    and the type reference keep their own focuses, that `details` reports the
 *    link as its own relation rather than folding it into calls or types, and
 *    that neither bounded operation carries a tag.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP trace traverses documentation links only under full focus, execution reaches only its helper, types reaches IUsed, details separates calls/types, and neighbors preserve both documentation directions.
 * @evidence contracts/testing.md#independent-expectations The written link, call and type references independently define the three expected neighborhoods; literal negative docTags checks prevent documentation payload leakage into tour and trace.
 * @evidence contracts/testing.md#distinguishing-cases Full, execution and types focus differ on the same graph; direct detail dependencies contrast optional neighbors and bounded tour/trace payloads.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_documentation_links_are_traversable_only_in_full_focus starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native documentation edges and ordinary checker references must survive transport together before the application applies focus and projection policy.
 * @evidence contracts/e2e.md#shared-execution All focus and detail requests share one fixture/session and suite producer. This fixture can join compatible documentation/citation inputs; cross-case shared-session work is still incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned links and declarations are immutable during requests; stdin ends and exit is awaited in finally without an exit-code assertion. The client observes close from construction, rejects pending requests on child failure, and terminates a child that exceeds its exit timeout.
 * @evidence contracts/e2e.md#preserved-coverage All original traversal sets, documentation edge directions, calls/types and docTags-absence assertions are preserved. No semantic coverage transfer is claimed by adding these acknowledgments.
 */
export const test_ttscgraph_documentation_links_are_traversable_only_in_full_focus =
  async () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            rootDir: "src",
            outDir: "dist",
          },
          include: ["src"],
        },
        null,
        2,
      ),
      "src/app.ts": [
        "export interface ICited {",
        "  note: string;",
        "}",
        "",
        "export interface IUsed {",
        "  value: number;",
        "}",
        "",
        "export function helper(): void {}",
        "",
        "/**",
        " * Renders the notice.",
        " *",
        " * @evidence {@link ICited} The contract this mirrors.",
        " */",
        "export function renderNotice(input: IUsed): void {",
        "  helper();",
        "}",
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

      const trace = async (focus: string): Promise<TraceResult> =>
        resultOf<TraceResult>(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `What does renderNotice reach under ${focus}?`,
              request: {
                type: "trace",
                from: "renderNotice",
                direction: "forward",
                focus,
                maxDepth: 1,
              },
            }),
          })) as ToolResult,
          "trace",
        );

      const all = await trace("all");
      assert.ok(
        all.reached.some((node) => node.name === "ICited"),
        `the full focus must reach the documented type: ${JSON.stringify(all.reached)}`,
      );
      assert.ok(
        all.hops.some((hop) => hop.kind === "doc_ref"),
        `the full focus must traverse the documentation relation: ${JSON.stringify(all.hops)}`,
      );

      // The narrowed focuses are the point. A documentation mention is not a
      // runtime step and not a type position, so neither may report it.
      const execution = await trace("execution");
      assert.deepStrictEqual(
        execution.reached.map((node) => node.name),
        ["helper"],
        "an execution trace must reach the call and nothing documented",
      );
      const types = await trace("types");
      assert.deepStrictEqual(
        types.reached.map((node) => node.name),
        ["IUsed"],
        "a type trace must reach the annotation and nothing documented",
      );

      const details = resultOf<DetailsResult>(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "What does renderNotice depend on?",
            request: {
              type: "details",
              handles: ["renderNotice"],
              neighbors: true,
              // The default neighbour slice is two, and this declaration has
              // three outgoing relations; raise it so the assertion is about
              // where the link lands rather than about the cap.
              neighborLimit: 3,
            },
          }),
        })) as ToolResult,
        "details",
      );
      const notice = details.nodes[0];
      assert.deepStrictEqual(
        notice?.calls?.map((ref) => ref.name),
        ["helper"],
        "a documentation link must not be folded into calls",
      );
      assert.deepStrictEqual(
        notice?.types?.map((ref) => ref.name),
        ["IUsed"],
        "a documentation link must not be folded into type references",
      );
      assert.ok(
        notice?.dependsOn?.some(
          (ref) => ref.name === "ICited" && ref.relation === "doc_ref",
        ),
        `the neighbor summary must carry the link under its own relation: ${JSON.stringify(notice?.dependsOn)}`,
      );

      // The relation reads from the other end too: asking about the cited type
      // shows the declaration whose documentation names it. That is the shape a
      // reader uses to go from a contract to the code answering for it, and it
      // comes from the same edge rather than a second index.
      const cited = resultOf<DetailsResult>(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "What answers to ICited?",
            request: {
              type: "details",
              handles: ["ICited"],
              neighbors: true,
            },
          }),
        })) as ToolResult,
        "details",
      );
      assert.ok(
        cited.nodes[0]?.dependedOnBy?.some(
          (ref) => ref.name === "renderNotice" && ref.relation === "doc_ref",
        ),
        `the cited type must list its documenter: ${JSON.stringify(cited.nodes[0]?.dependedOnBy)}`,
      );

      // Neither bounded operation carries a tag. Both are held to a token
      // budget that has been cut twice for this reason, and neither answers a
      // citation question — a tour is asked what the project is and how it
      // runs, and a trace follows what reaches what. The declaration in this
      // fixture does carry a tag, so an absence here is a decision rather than
      // an empty project.
      for (const request of [
        { type: "tour", reinterpretations: [] },
        { type: "trace", from: "renderNotice", direction: "forward" },
      ]) {
        const payload = JSON.stringify(
          resultOf<{ type: string }>(
            (await client.request("tools/call", {
              name: "inspect_typescript_graph",
              arguments: graphArguments({
                thinking: "What is this project made of?",
                request,
              }),
            })) as ToolResult,
            request.type,
          ),
        );
        assert.ok(
          !payload.includes("docTags"),
          `${request.type} must carry no documentation tag: ${payload.slice(0, 200)}`,
        );
      }
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
