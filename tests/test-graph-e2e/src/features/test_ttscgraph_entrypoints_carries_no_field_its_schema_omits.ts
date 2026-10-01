import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
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

/**
 * Verifies `entrypoints` returns no documentation tags, because its own result
 * shape declares none.
 *
 * It builds its hits by copying `lookup`'s, and `lookup` may carry the tags
 * that matched a citation query. Copying the hit wholesale therefore put a
 * field on the wire that this result's schema does not describe — invisible to
 * every assertion about entrypoints, and exactly the kind of drift a typed
 * contract exists to prevent.
 *
 * The query has to be one that reaches the citation path, or the assertion is
 * vacuous: `entrypoints` inherits the field only when `lookup` would have
 * produced it, and a plain symbol name produces none. So the same address is
 * asked of both operations, and `lookup` carrying the field is what proves the
 * `entrypoints` absence is the schema being kept rather than nothing
 * happening.
 *
 * 1. Materialize a project whose entry declaration carries a documentation tag.
 * 2. Ask both operations for the address that tag names.
 * 3. Assert `lookup` carries the field, `entrypoints` does not, and `details`
 *    still returns the tag.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP lookup returns matched citation tags, entrypoints returns nonempty hits without docTags, and details still exposes the declaration's tags.
 * @evidence contracts/testing.md#independent-expectations The public entrypoints DTO omits docTags while lookup/details support them; the literal own-property absence check catches copying the lookup DTO wholesale.
 * @evidence contracts/testing.md#distinguishing-cases The same tagged declaration is a positive lookup/details control and a negative entrypoints payload control, distinguishing field projection from missing producer metadata.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_entrypoints_carries_no_field_its_schema_omits starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual native tag publication and MCP serialization must preserve tags where allowed while omitting them from the entrypoints wire shape.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Nonempty hits, lookup tags, absence from every entrypoint hit and details tags remain executable here; schema-only comparison is not used as a replacement.
 */
export const test_ttscgraph_entrypoints_carries_no_field_its_schema_omits =
  async () => {
    await withIdentityBoundary(async (client) => {
      const call = async (
        request: Record<string, unknown>,
      ): Promise<Record<string, unknown>> => {
        const result = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "Where does this application start?",
            request,
          }),
        })) as ToolResult;
        const value = (result.structuredContent ?? {}) as {
          result?: Record<string, unknown>;
        };
        if (value.result === undefined)
          // The tool validates its own output, so an undeclared property is
          // rejected before the result is built and this is where a schema
          // drift surfaces. Carry the whole payload out, or the failure names
          // the absence and not the field that caused it.
          throw new Error(
            `The graph returned no result for ${JSON.stringify(request)}. ` +
              `Payload: ${JSON.stringify(result)}`,
          );
        return value.result;
      };

      const address = "docs/boot.md#start";

      // The control. Without this the assertion below proves nothing: a plain
      // name reaches no citation, so `entrypoints` would carry no tag whatever
      // the copy did.
      const lookup = (await call({ type: "lookup", query: address })) as {
        hits?: Record<string, unknown>[];
      };
      assert.ok(
        (lookup.hits ?? []).some((hit) => "docTags" in hit),
        `lookup must carry the matching tag for this query: ${JSON.stringify(lookup.hits)}`,
      );

      const entrypoints = (await call({
        type: "entrypoints",
        query: address,
      })) as { hits?: Record<string, unknown>[] };
      assert.ok(
        (entrypoints.hits ?? []).length > 0,
        "the fixture must produce at least one entrypoint hit to assert about",
      );
      assert.deepStrictEqual(
        (entrypoints.hits ?? []).filter((hit) => "docTags" in hit),
        [],
        "an entrypoints hit must not carry a field its result shape omits",
      );

      // The negative twin: the tag is present, and the operation whose schema
      // declares it does return it. The absence above is the contract being
      // kept, not the fact going missing.
      const details = (await call({
        type: "details",
        handles: ["bootstrap"],
      })) as { nodes?: Record<string, unknown>[] };
      assert.ok(
        (details.nodes ?? []).some((node) => "docTags" in node),
        `details must still carry the tag: ${JSON.stringify(details.nodes)}`,
      );
    });
  };
