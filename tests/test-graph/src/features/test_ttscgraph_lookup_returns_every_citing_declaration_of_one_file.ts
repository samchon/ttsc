import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

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
 *
 * @evidence contracts/testing.md#behavioral-verification MCP citation lookup returns all five same-file carriers without truncation, ordinary name lookup keeps its per-file diversity cap, and an explicit citation limit returns three with truncation.
 * @evidence contracts/testing.md#independent-expectations Five authored tag carriers and the literal requested limit independently specify counts and membership; name-ranking diversity must not silently remove exact citation answers.
 * @evidence contracts/testing.md#distinguishing-cases Default citation completeness contrasts name diversity and an explicit three-hit bound, separating omission policy from whether a match exists.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_lookup_returns_every_citing_declaration_of_one_file starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real native comment facts must feed the citation index and the MCP response's truncation flag; fabricated carriers bypass extraction and wire assembly.
 * @evidence contracts/e2e.md#shared-execution Twenty-one identity/display, citation, DTO/audit, traversal and installed MCP protocol entries borrow one project, initialized MCP session and resident native compiler. The MCP case checks that same initialize payload/tool list and temporarily selects its original closed source universe for global ranking; config restoration and object edits advance real generations. Checker rejection also executes the public dump CLI once for diagnostic/raw-edge delivery.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique files, names, contracts, chain topologies and citation targets isolate fixtures; spec/test suffixes, decorator configuration and real external declarations remain. The roster has no other name matches. MCP ranking scopes compiler include to its two sources and restores exact config bytes in finally; later requests synchronize that generation. Suite finally closes the shared client and checks normal exit after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Exact five carriers, absent default truncation, bounded name count, explicit three-hit count and true truncation remain here.
 */
export const test_ttscgraph_lookup_returns_every_citing_declaration_of_one_file =
  async () => {
    await withIdentityBoundary(async (client) => {
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

      const all = await lookup("docs/roster.md#fulfillment");
      assert.deepStrictEqual(
        all.hits.map((hit) => hit.name).sort(),
        ["rosterCarrier1", "rosterCarrier2", "rosterCarrier3", "rosterCarrier4", "rosterCarrier5"],
        "every declaration citing the address must be returned, though they share a file",
      );
      assert.strictEqual(
        all.truncated,
        undefined,
        "nothing was left out, so nothing may claim it was",
      );

      // The negative twin: the per-file cap still governs a name query, which is
      // what it exists for. `rosterCarrier` matches all five by subword.
      const byName = await lookup("rosterCarrier");
      assert.ok(
        byName.hits.length <= 3,
        `a name query must stay capped per file: ${JSON.stringify(byName.hits.map((h) => h.name))}`,
      );

      // A limit below the carrier count cuts, and the result says so rather than
      // presenting three of five as the answer.
      const capped = await lookup("docs/roster.md#fulfillment", 3);
      assert.strictEqual(capped.hits.length, 3);
      assert.strictEqual(
        capped.truncated,
        true,
        "a limit that cut the carriers must be reported",
      );
    });
  };
