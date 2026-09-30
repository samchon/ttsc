import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

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
 * single "what is this" call. So identity is uncapped and fan-out is a small
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
 * @evidence contracts/testing.md#distinguishing-cases Uncapped members and literals contrast bounded inbound fan-out in the same response. Explicit capped completeness dispatch has a separate direct application source unit.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_details_gives_whole_identity_and_caps_fan_out starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The actual compiler snapshot must carry the full identity before the MCP projection caps popularity-based context; fabricated identity inputs would bypass that producer connection.
 * @evidence contracts/e2e.md#shared-execution Eighteen identity/display, documentation/citation, DTO/audit and dispatch entries borrow one composite project, initialized MCP session and resident native compiler. Only the object-source mutation requires a new generation. The checker-rejection entry also executes the public dump CLI once because diagnostics/raw edges are a separate entrypoint connection; all named assertions remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source files, symbol names and citation targets isolate fixtures; disjoint dispatch contracts and hub populations prevent cross-case implementations. Role-sensitive sources retain their spec/test suffix and real dependency declarations stay external. Only object-outline.ts changes; suite finally closes the shared client and checks successful exit after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage The member-count, literal-count and positive bounded-inbound assertions all remain here. These checks cannot detect an incorrect member name when the count stays twenty.
 */
export const test_ttscgraph_details_gives_whole_identity_and_caps_fan_out =
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
