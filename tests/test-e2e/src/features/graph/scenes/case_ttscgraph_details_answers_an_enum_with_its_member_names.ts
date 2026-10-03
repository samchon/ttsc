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
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details returns qualified Colors.Red/Green/Blue members, their signatures and values, implicit numeric members, one deduplicated duplicate value, and a neighboring class method.
 * @evidence contracts/testing.md#independent-expectations The authored enum declarations independently specify names and literal values; the class is a non-enum control, so value-only output cannot satisfy the named-member assertions.
 * @evidence contracts/testing.md#distinguishing-cases String, implicit-number and duplicate-value enums contrast a class outline; this case does not exercise an explicit member cap. tests/test-graph/src/features/test_ttscgraph_details_audit_withdraws_completeness_when_capped.ts owns the direct application default/2-versus-1 memberLimit contrast without certifying native extraction or current execution.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_details_answers_an_enum_with_its_member_names borrows the experiment's shared built workspace MCP/native session and drives its actual stdio connection with the explicit workspace binary override; this is not a consumer-local packed SDK installation. It remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native enum facts must survive snapshot transport, model construction and details projection; a synthetic member list cannot establish that the compiler actually publishes them.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and built workspace decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients. Sharing the client/project is not proof of Program-object reuse, total construction or packed publication identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage Original exact names, Red signature, literals, numeric values, duplicate-value and class-method assertions remain in this boundary entry; no portable semantic assertion has been removed.
 */
export const case_ttscgraph_details_answers_an_enum_with_its_member_names =
  async () => {
    await withIdentityBoundary(async (client) => {
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
    });
  };
