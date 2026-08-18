import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface LookupResult {
  type: "lookup";
  hits: { name: string; docTags?: { name: string; text?: string }[] }[];
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
 * Verifies the citation index holds addresses and not the first word of
 * ordinary prose.
 *
 * Every tag TypeScript does not recognize reaches this index, and most of them
 * are not citations: `@todo`, `@remarks`, `@example`, and `@default` are
 * unknown to the compiler too. Keying on the leading token alone made `@todo
 * Add caching here` a carrier of the address `Add`, so a question opening with
 * that word answered with it — ranked above every real name match and labelled
 * a certain citation. A separator is what tells an address from a word.
 *
 * 1. Materialize a project with a real citation, a `@todo` opening with an English
 *    word, a `@default` holding a bare number, and a URL reference.
 * 2. Query the prose word, the number, the URL, and the real address.
 * 3. Assert only the addresses answer through the citation index, and that a prose
 *    word neither matches nor outranks an ordinary name hit.
 */
export const test_ttscgraph_lookup_indexes_addresses_and_not_prose =
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
        "/** @evidence docs/pricing.md#sale Implements the pricing rule. */",
        "export function priced(): void {}",
        "",
        "/** @todo Add caching here. */",
        "export function cached(): void {}",
        "",
        "/** @default 4 */",
        "export const retries = 4;",
        "",
        "/** @reference https://example.com/spec#part Background reading. */",
        "export function referenced(): void {}",
        "",
        "/** A function whose name is the prose word. */",
        "export function Add(): void {}",
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

      const lookup = async (query: string): Promise<LookupResult> =>
        lookupOf(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `Looking for ${query}`,
              request: { type: "lookup", query },
            }),
          })) as ToolResult,
        );

      // An address answers through the index.
      const address = await lookup("docs/pricing.md#sale");
      assert.strictEqual(
        address.hits[0]?.name,
        "priced",
        "a real address must answer with its citing declaration",
      );

      // The prose word does not. The declaration actually named `Add` is the
      // answer, and `cached` — whose `@todo` opens with that word — must not
      // appear as a citation carrier at all.
      const prose = await lookup("Add");
      assert.strictEqual(
        prose.hits[0]?.name,
        "Add",
        `a prose word must rank the symbol that bears it: ${JSON.stringify(prose.hits.map((h) => h.name))}`,
      );
      assert.deepStrictEqual(
        prose.hits.filter((hit) => hit.docTags !== undefined),
        [],
        "no declaration may be returned as citing a prose word",
      );

      // A bare number is not an address either.
      const number = await lookup("4");
      assert.deepStrictEqual(
        number.hits.filter((hit) => hit.docTags !== undefined),
        [],
        "a bare number must not index as a citation target",
      );

      // A URL is: it carries separators and is exactly how a reference is
      // spelled.
      const url = await lookup("https://example.com/spec#part");
      assert.strictEqual(
        url.hits[0]?.name,
        "referenced",
        `a URL reference must answer through the index: ${JSON.stringify(url.hits.map((h) => h.name))}`,
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
