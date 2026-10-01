import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

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
 *
 * @evidence contracts/testing.md#behavioral-verification MCP lookup returns the exact declarations citing a markdown target with only matching tags, an operation address leads its result, and details preserves ordered multiline tags with a prose summary.
 * @evidence contracts/testing.md#independent-expectations Authored tag targets, carrier names and literal joined text define expectations; untagged declarations and unmatched tags cannot acquire citation metadata.
 * @evidence contracts/testing.md#distinguishing-cases Markdown and operation addresses contrast unrelated tags, multiline tag continuation and an untagged symbol; details must separate prose summary from the tag sequence.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_lookup_answers_the_reverse_citation_question starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The native producer must attach real declaration comments and transport their tag order before the reverse citation index and MCP DTO projection can answer.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Exact carriers, matching-tag filtering, operation precedence, ordered joined tags, summary and untagged-undefined assertions are all retained.
 */
export const test_ttscgraph_lookup_answers_the_reverse_citation_question =
  async () => {
    await withIdentityBoundary(async (client) => {
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
    });
  };
