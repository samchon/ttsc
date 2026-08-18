import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface LookupResult {
  type: "lookup";
  hits: {
    id: string;
    name: string;
    file: string;
    docTags?: { name: string; text?: string }[];
  }[];
}

interface DetailsResult {
  type: "details";
  nodes: {
    name: string;
    doc?: string;
    docTags?: { name: string; text?: string }[];
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
 * Verifies a `lookup` naming a documentation target answers with the
 * declarations that cite it, and that `details` returns a declaration's tags.
 *
 * The forward direction costs a reader one file: the tag sits above the
 * declaration they already found. The reverse direction — which code implements
 * `docs/pricing.md#sale` — is scattered across every file that implements the
 * document, so without an index it is a repository-wide search, which is the
 * cost this server exists to remove. Before this the graph carried no tag at
 * all: `docOf` stops at the first line beginning with `@`, so no request type
 * had any path by which one could be returned.
 *
 * 1. Materialize a project whose declarations cite a Markdown section, an API
 *    operation, and a reference document, with one uncited declaration beside
 *    them.
 * 2. Look up the Markdown target, then the operation target.
 * 3. Assert each answers with exactly the citing declarations and the tag that
 *    matched, and that `details` returns every tag while `doc` stays prose.
 */
export const test_ttscgraph_lookup_answers_the_reverse_citation_question =
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
      "src/notice.ts": [
        "/**",
        " * Renders the stacking notice.",
        " *",
        " * @evidence docs/discount.md#coupon-stacking States the per-issuer",
        " *           stacking limit this section defines.",
        " * @evidence POST:/orders/{orderId}/coupons Explains the rejection.",
        " */",
        "export function renderNotice(): string {",
        "  return 'notice';",
        "}",
        "",
      ].join("\n"),
      "src/checkout.ts": [
        "/** @evidence docs/discount.md#coupon-stacking Enforces the same limit. */",
        "export function applyCoupons(): number {",
        "  return 0;",
        "}",
        "",
        "/** @reference https://example.com/spec Background reading. */",
        "export function documented(): void {}",
        "",
        "/** Carries no tag at all. */",
        "export function untagged(): void {}",
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
        resultOf<LookupResult>(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `Which code implements ${query}?`,
              request: { type: "lookup", query },
            }),
          })) as ToolResult,
          "lookup",
        );

      const markdown = await lookup("docs/discount.md#coupon-stacking");
      assert.deepStrictEqual(
        markdown.hits.map((hit) => hit.name).sort(),
        ["applyCoupons", "renderNotice"],
        "the Markdown target must answer with exactly its citing declarations",
      );
      for (const hit of markdown.hits) {
        assert.deepStrictEqual(
          (hit.docTags ?? []).map((tag) => (tag.text ?? "").split(" ")[0]),
          ["docs/discount.md#coupon-stacking"],
          `hit ${hit.name} must carry the tag that matched, and only it`,
        );
      }

      // An operation target is one token, braces included. Exactly one
      // declaration cites it, and it comes first: a citation is an exact match
      // on a token the author and the caller both spell, so it outranks the
      // name scoring that also puts `applyCoupons` on the list for sharing the
      // word "coupons". Both belong in a ranked shortlist; only one of them is
      // the answer to "who implements this operation", and only it carries the
      // tag that says so.
      const operation = await lookup("POST:/orders/{orderId}/coupons");
      assert.strictEqual(
        operation.hits[0]?.name,
        "renderNotice",
        "the citing declaration must outrank every name match",
      );
      assert.deepStrictEqual(
        operation.hits
          .filter((hit) => hit.docTags !== undefined)
          .map((hit) => hit.name),
        ["renderNotice"],
        "only the declaration that wrote the target carries a matching tag",
      );

      const details = resultOf<DetailsResult>(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "What does renderNotice implement, and what is untagged?",
            request: {
              type: "details",
              handles: ["renderNotice", "untagged"],
            },
          }),
        })) as ToolResult,
        "details",
      );
      const notice = details.nodes.find((node) => node.name === "renderNotice");
      // A reason written across two comment lines is one string.
      assert.deepStrictEqual(
        notice?.docTags,
        [
          {
            name: "evidence",
            text: "docs/discount.md#coupon-stacking States the per-issuer stacking limit this section defines.",
          },
          {
            name: "evidence",
            text: "POST:/orders/{orderId}/coupons Explains the rejection.",
          },
        ],
        "details must return every tag, in source order, joined into one line each",
      );
      // The prose summary still stops above the tag block: two channels, not one.
      assert.strictEqual(
        notice?.doc,
        "Renders the stacking notice.",
        "the prose summary must be unchanged by the tags below it",
      );
      const untagged = details.nodes.find((node) => node.name === "untagged");
      assert.strictEqual(
        untagged?.docTags,
        undefined,
        "a declaration carrying no tag must carry no field at all",
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
