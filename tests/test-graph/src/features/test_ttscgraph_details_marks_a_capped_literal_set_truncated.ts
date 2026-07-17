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
    literals?: string[];
    literalsTruncated?: boolean;
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
 * Verifies a value set larger than the response cap comes back cut and says so.
 *
 * `literals` claims to be the whole type, which is the entire point of resolving
 * it from the checker instead of scraping the declaration — so the one case
 * where it is a prefix has to be marked, or the claim is false exactly the way
 * the old six-value cut was (#732). The truncation is invisible without the
 * marker: 60 plausible members read as a complete 60-member union. The fixture
 * crosses two unions in a template literal so the checker expands them into 72
 * members, more than any hand-written union but the same shape on the wire, and
 * the dump carries all 72 because the cap belongs to the response and not to the
 * graph.
 *
 * 1. Materialize a project whose type expands to 72 string literals.
 * 2. Ask the MCP server for `details` on it and on a small union beside it.
 * 3. Assert the big one is cut to the cap and marked, and the small one is
 *    whole and unmarked.
 */
export const test_ttscgraph_details_marks_a_capped_literal_set_truncated =
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
        "type Letter = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i';",
        "type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';",
        "",
        "// 9 x 8 = 72 members, expanded by the checker.",
        "export type Big = `${Letter}${Digit}`;",
        "",
        "export type Small = 'x' | 'y';",
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
          thinking: "Which values do these types admit?",
          request: { type: "details", handles: ["Big", "Small"] },
        }),
      })) as ToolResult;

      const details = detailsOf(result);
      const nodeOf = (name: string) =>
        details.nodes.find((node) => node.name === name);

      const big = nodeOf("Big");
      assert.ok(big !== undefined, "the expanded union resolved to a node");
      // Cut to the cap rather than shipped whole: 72 members were resolved.
      assert.strictEqual(
        big.literals?.length,
        60,
        `the value set is cut to the response cap: ${String(big.literals?.length)}`,
      );
      // The claim `literals` makes is completeness, so the exception is stated.
      assert.strictEqual(
        big.literalsTruncated,
        true,
        "a cut value set says it was cut",
      );
      // What survives the cut is still the type's own values, in source form.
      assert.ok(
        big.literals?.[0] === '"a0"',
        `the kept values are real members: ${JSON.stringify(big.literals?.slice(0, 2))}`,
      );

      // The negative twin: a set that fits is whole and carries no marker, so
      // the flag tracks the cap rather than being stamped on every union.
      const small = nodeOf("Small");
      assert.deepStrictEqual(
        small?.literals,
        ['"x"', '"y"'],
        `an uncapped value set is complete: ${JSON.stringify(small?.literals)}`,
      );
      assert.strictEqual(
        small?.literalsTruncated,
        undefined,
        "an uncapped value set is not marked truncated",
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
