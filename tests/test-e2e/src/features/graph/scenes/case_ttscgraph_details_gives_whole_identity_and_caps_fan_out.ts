import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface DetailsResult {
  type: "details";
  nodes: {
    name: string;
    members?: unknown[];
    literals?: string[];
    calls?: unknown[];
    dependedOnBy?: unknown[];
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
 * Verifies `details` returns a symbol's whole identity and only a slice of its
 * fan-out.
 *
 * The caller named the handle to learn what it is, so its identity — a class's
 * members, a union's values — is the answer and is not sampled: cut it and the
 * model reads the file for the rest, the read this index exists to remove. Its
 * fan-out is a different thing. What names or uses a symbol grows with the
 * symbol's popularity, not with the symbol, so a central type answers with a
 * thousand "who uses me" refs — a hundred thousand tokens of trace/impact in a
 * single "what is this" call. So the default identity request is uncapped and fan-out is a small
 * orientation slice, measured on real repositories: an uncapped `DataSource`
 * came back 390 KB, of which 380 KB was its 1060 type-references.
 *
 * 1. Materialize a class of 20 members and a union of 20 literals, plus 20
 *    functions that all reference the class in a parameter type.
 * 2. Ask `details` for the class (with neighbors) and the union.
 * 3. Assert every member and value comes back, and that the 20 inbound references
 *    are capped to the fan-out slice.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details on a twenty-member class and twenty-value union retains both identity counts while returning a nonempty inbound neighborhood smaller than twenty.
 * @evidence contracts/testing.md#independent-expectations The fixture independently contains twenty declarations and literal alternatives; the fan-out oracle is the inequalities zero < count < twenty, not an exact neighbor cap or complete name comparison.
 * @evidence contracts/testing.md#distinguishing-cases Default uncapped members and literals contrast bounded inbound fan-out in the same response. Explicit capped completeness dispatch belongs to tests/test-graph/src/features/test_ttscgraph_details_audit_withdraws_completeness_when_capped.ts, whose direct default/2-versus-1 memberLimit observations certify neither native extraction nor current execution.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_details_gives_whole_identity_and_caps_fan_out borrows the experiment's shared built workspace MCP/native session and drives its actual stdio connection with the explicit workspace binary override; this is not a consumer-local packed SDK installation. It remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The actual compiler snapshot must carry the full identity before the MCP projection caps popularity-based context; fabricated identity inputs would bypass that producer connection.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and built workspace decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients. Sharing the client/project is not proof of Program-object reuse, total construction or packed publication identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage The member-count, literal-count and positive bounded-inbound assertions all remain here. These checks cannot detect an incorrect member name when the count stays twenty.
 */
export const case_ttscgraph_details_gives_whole_identity_and_caps_fan_out =
  async () => {
    await withIdentityBoundary(async (client) => {
      const result = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: "What are these symbols?",
          request: {
            type: "details",
            handles: ["Wide", "Values"],
            neighbors: true,
          },
        }),
      })) as ToolResult;

      const details = detailsOf(result);
      const nodeOf = (name: string) =>
        details.nodes.find((node) => node.name === name);

      // Identity, whole: all 20 members, past the old cap of 6/8.
      const wide = nodeOf("Wide");
      assert.strictEqual(
        wide?.members?.length,
        20,
        `every member is returned, not a page: ${String(wide?.members?.length)}`,
      );
      // Identity, whole: all 20 values, past the old cap of 60 only in spirit —
      // the point is there is no cap now.
      assert.strictEqual(
        nodeOf("Values")?.literals?.length,
        20,
        `every value is returned: ${String(nodeOf("Values")?.literals?.length)}`,
      );

      // Fan-out, sliced: 20 functions take Wide as a parameter type, and the
      // reverse-reference list is the popularity-scaled part, so it is capped to
      // the orientation slice rather than returned whole.
      const inbound = wide?.dependedOnBy?.length ?? 0;
      assert.ok(
        inbound > 0 && inbound < 20,
        `fan-out is an orientation slice, not the whole ${20}: got ${String(inbound)}`,
      );
    });
  };
