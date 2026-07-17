import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface DetailsResult {
  type: "details";
  nodes: {
    name: string;
    calls?: unknown[];
    members?: unknown[];
    truncated?: string[];
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

const detailsOf = (result: ToolResult): DetailsResult => {
  const value = (result.structuredContent ?? {}) as { result?: DetailsResult };
  if (value.result?.type !== "details")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/**
 * Verifies `details` names the fields it cut, and names none it did not.
 *
 * Every list on a node is capped, and a cap is invisible in the payload: two
 * refs on a function that calls twenty look exactly like two refs on a function
 * that calls two. The audit tells the caller a result is "bounded only where
 * `truncated` says" and to re-verify nothing, so without the marker it is an
 * instruction to trust a slice as the whole — #732's shape, arriving through
 * the neighbor lists instead of the value set (#737).
 *
 * The exactly-at-the-limit case is the one that makes the marker mean
 * something: reaching a cap is not the same fact as there being more, so a
 * function calling exactly `dependencyLimit` things must come back unmarked.
 *
 * 1. Materialize a project with a function that calls twenty others, one that
 *    calls exactly two, one that calls one, and a class of ten methods.
 * 2. Ask for `details` on all four with the default limits.
 * 3. Assert the over-limit ones name their cut field and the others name
 *    nothing.
 */
export const test_ttscgraph_details_names_each_field_it_cut = async () => {
  const targets = Array.from({ length: 20 }, (_, i) => `t${String(i)}`);
  const methods = Array.from({ length: 10 }, (_, i) => `  m${String(i)}(): void {}`);
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
      ...targets.map((t) => `export function ${t}(): void {}`),
      "",
      "// Twenty calls, and the default dependencyLimit is 2.",
      `export function many(): void {`,
      ...targets.map((t) => `  ${t}();`),
      "}",
      "",
      "// Exactly the default limit: reached, but nothing was lost.",
      "export function exactlyTwo(): void {",
      "  t0();",
      "  t1();",
      "}",
      "",
      "export function justOne(): void {",
      "  t0();",
      "}",
      "",
      "// Ten members, and the default memberLimit is 6.",
      "export class Wide {",
      ...methods,
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

    const result = (await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: graphArguments({
        thinking: "What do these symbols depend on?",
        request: {
          type: "details",
          handles: ["many", "exactlyTwo", "justOne", "Wide"],
        },
      }),
    })) as ToolResult;

    const details = detailsOf(result);
    const nodeOf = (name: string) =>
      details.nodes.find((node) => node.name === name);

    // Twenty calls, two returned: the case the marker exists for.
    const many = nodeOf("many");
    assert.strictEqual(many?.calls?.length, 2, "the call list is cut to the cap");
    assert.deepStrictEqual(
      many?.truncated,
      ["calls"],
      `a cut call list names itself: ${JSON.stringify(many?.truncated)}`,
    );

    // The boundary: exactly at the limit is whole, so the marker stays off. A
    // check that only asked "did we reach the cap" would mark this one.
    const exactlyTwo = nodeOf("exactlyTwo");
    assert.strictEqual(exactlyTwo?.calls?.length, 2, "both calls are returned");
    assert.strictEqual(
      exactlyTwo?.truncated,
      undefined,
      `a list that fits exactly is not marked: ${JSON.stringify(exactlyTwo?.truncated)}`,
    );

    // Under the limit: nothing to say.
    assert.strictEqual(
      nodeOf("justOne")?.truncated,
      undefined,
      "a list under the cap is not marked",
    );

    // A different field, cut by a different limit, named on its own.
    const wide = nodeOf("Wide");
    assert.strictEqual(wide?.members?.length, 6, "the member list is cut to the cap");
    assert.deepStrictEqual(
      wide?.truncated,
      ["members"],
      `a cut member list names itself, and only itself: ${JSON.stringify(wide?.truncated)}`,
    );
  } finally {
    client.endStdin();
    await client.waitForExit();
  }
};
