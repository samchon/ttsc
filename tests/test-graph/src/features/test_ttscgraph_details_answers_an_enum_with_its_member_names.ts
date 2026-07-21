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
    kind: string;
    literals?: string[];
    members?: { name: string; kind: string; signature?: string }[];
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
 * Verifies `details` on an enum answers with the member names a caller writes,
 * not only the values they carry.
 *
 * The enum's node has always been in the graph, and asking about it returned
 * nothing you could type. Its `signature` stops at the `{`, its members are not
 * nodes so the member outline a class gets is empty, and #732 gave it values
 * alone — but the code says `Colors.Red` and never `"red"`. So the one kind
 * whose entire content is its member list was the kind `details` could not
 * describe, and a caller that had already named it opened the file anyway,
 * which is the grep this index exists to remove (#738).
 *
 * 1. Materialize a project with a string enum, an implicitly numbered enum, and a
 *    class beside them.
 * 2. Ask the MCP server for `details` on all three.
 * 3. Assert each enum answers with names and values, and that the class's outline
 *    is unaffected.
 */
export const test_ttscgraph_details_answers_an_enum_with_its_member_names =
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
        "export enum Colors {",
        "  Red = 'red',",
        "  Green = 'green',",
        "  Blue = 'blue',",
        "}",
        "",
        "export enum Implicit {",
        "  First,",
        "  Second,",
        "}",
        "",
        "// Two members, one value: a type folds these, a declaration does not.",
        "export enum Dup {",
        "  A = 'x',",
        "  B = 'x',",
        "}",
        "",
        "export class Cls {",
        "  public run(): void {}",
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
          thinking: "What are these enums and what may I write?",
          request: {
            type: "details",
            handles: ["Colors", "Implicit", "Dup", "Cls"],
          },
        }),
      })) as ToolResult;

      const details = detailsOf(result);
      const nodeOf = (name: string) =>
        details.nodes.find((node) => node.name === name);

      // The names, owner-qualified so they read the way the code writes them.
      const colors = nodeOf("Colors");
      assert.deepStrictEqual(
        colors?.members?.map((m) => m.name),
        ["Colors.Red", "Colors.Green", "Colors.Blue"],
        `the enum answers with its member names: ${JSON.stringify(colors?.members)}`,
      );
      // Name and value together: `Red = "red"` is one fact, not two.
      assert.strictEqual(
        colors?.members?.[0]?.signature,
        'Red = "red"',
        `a member carries the value it holds: ${JSON.stringify(colors?.members?.[0])}`,
      );
      // The values still come through the field that answers "what may this be".
      assert.deepStrictEqual(
        colors?.literals,
        ['"red"', '"green"', '"blue"'],
        `the value set is unchanged: ${JSON.stringify(colors?.literals)}`,
      );

      // Implicit numbering: these values are in the checker and nowhere in the
      // source text, so nothing that reads the file could pair them.
      assert.deepStrictEqual(
        nodeOf("Implicit")?.members?.map((m) => m.signature),
        ["First = 0", "Second = 1"],
        `implicit members pair with resolved values: ${JSON.stringify(nodeOf("Implicit")?.members)}`,
      );

      // Two members, one value. The declared type folds them into one
      // constituent — a type is a set — so a member list read off the type
      // would report `A` and lose `B`, silently, which is the defect this whole
      // area exists to be rid of. The list is the declaration's; the value set
      // is right to hold `"x"` once.
      const dup = nodeOf("Dup");
      assert.deepStrictEqual(
        dup?.members?.map((m) => m.name),
        ["Dup.A", "Dup.B"],
        `a member sharing another's value is still listed: ${JSON.stringify(dup?.members)}`,
      );
      assert.deepStrictEqual(
        dup?.literals,
        ['"x"'],
        `the value set holds each distinct value once: ${JSON.stringify(dup?.literals)}`,
      );

      // The negative twin: a class's outline comes from its member nodes and is
      // untouched by any of this.
      assert.deepStrictEqual(
        nodeOf("Cls")?.members?.map((m) => m.name),
        ["Cls.run"],
        `a class outline is unaffected: ${JSON.stringify(nodeOf("Cls")?.members)}`,
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
