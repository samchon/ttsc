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
 *    and the type reference keep their own focuses, and that `details` reports
 *    the link as its own relation rather than folding it into calls or types.
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
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
