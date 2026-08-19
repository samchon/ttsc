import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface LookupResult {
  type: "lookup";
  hits: { name: string }[];
  truncated?: boolean;
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

const lookupOf = (result: ToolResult): LookupResult => {
  const value = (result.structuredContent ?? {}) as { result?: LookupResult };
  if (value.result?.type !== "lookup")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/**
 * Verifies every declaration citing one address is returned, even when they
 * share a file, and that a limit which cuts them says so.
 *
 * `lookup` caps hits per file so one file's roster cannot crowd out a name
 * ranking. A citation is not ranked against anything — it is an exact match on
 * an address — and a module implementing one specification across several
 * functions is the ordinary shape of that answer, not a file dominating a
 * shortlist. Under the cap the graph returned three of five carriers and told
 * the caller the result resolved the question, which is a confidently
 * incomplete answer to the one question this index exists to answer.
 *
 * 1. Materialize one file whose five exported functions all cite one address.
 * 2. Look the address up.
 * 3. Assert all five come back, that a name query is still capped, and that a
 *    limit smaller than the carrier count reports `truncated`.
 */
export const test_ttscgraph_lookup_returns_every_citing_declaration_of_one_file =
  async () => {
    const declarations: string[] = [];
    for (let index = 1; index <= 5; index++) {
      declarations.push(
        `/** @evidence docs/spec.md#rule Implements part ${index}. */`,
        `export function part${index}(): void {}`,
        "",
      );
    }

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
      "src/all.ts": declarations.join("\n"),
    });

    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

      const lookup = async (
        query: string,
        limit?: number,
      ): Promise<LookupResult> =>
        lookupOf(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `Which code implements ${query}?`,
              request: {
                type: "lookup",
                query,
                ...(limit === undefined ? {} : { limit }),
              },
            }),
          })) as ToolResult,
        );

      const all = await lookup("docs/spec.md#rule");
      assert.deepStrictEqual(
        all.hits.map((hit) => hit.name).sort(),
        ["part1", "part2", "part3", "part4", "part5"],
        "every declaration citing the address must be returned, though they share a file",
      );
      assert.strictEqual(
        all.truncated,
        undefined,
        "nothing was left out, so nothing may claim it was",
      );

      // The negative twin: the per-file cap still governs a name query, which is
      // what it exists for. `part` matches all five by subword.
      const byName = await lookup("part");
      assert.ok(
        byName.hits.length <= 3,
        `a name query must stay capped per file: ${JSON.stringify(byName.hits.map((h) => h.name))}`,
      );

      // A limit below the carrier count cuts, and the result says so rather than
      // presenting three of five as the answer.
      const capped = await lookup("docs/spec.md#rule", 3);
      assert.strictEqual(capped.hits.length, 3);
      assert.strictEqual(
        capped.truncated,
        true,
        "a limit that cut the carriers must be reported",
      );
    } finally {
      client.endStdin();
    }

    assert.equal(await client.waitForExit(), 0, client.stderrText());
  };
