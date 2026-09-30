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
    kind: string;
    signature?: string;
    literals?: string[];
  }[];
  unknown: string[];
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
 * Verifies `details` reports the values a union or enum admits from the
 * checker's resolved type, so the answer does not depend on how the declaration
 * is wrapped.
 *
 * `literals` was scraped out of the `signature` snippet, which stops after four
 * source lines or at the first `{`, and was then cut to six. So a union written
 * one member per line reported the first three of them, an enum written across
 * lines reported none at all, and `type Indirect = Kind | 'f'` reported `'f'`
 * alone while the members reaching it through `Kind` disappeared — all
 * silently, under an audit telling the caller these facts are compiler-resolved
 * (#732). This pins the whole class end to end, through the real binary: the
 * same type must answer the same way whatever its layout, and a type whose
 * members cannot all be named must report none rather than a subset that reads
 * as complete.
 *
 * 1. Materialize a project holding a wrapped union, a flat twin, a multi-line
 *    enum, an aliased union, and a union widened by `string`.
 * 2. Ask the MCP server for `details` on all five.
 * 3. Assert each value set is complete and layout-independent, that indirection
 *    resolves, and that the widened union reports nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details reports the exact seven resolved union alternatives through wrappers and aliases, three enum values, an indirect union and its holder, while omitting literals for a widened type.
 * @evidence contracts/testing.md#independent-expectations Literal alternatives are specified in the authored TypeScript inputs rather than copied from the dump; the widened declaration independently requires an absent finite-value list.
 * @evidence contracts/testing.md#distinguishing-cases Wrapped versus flat and indirect versus held unions exercise resolution, and widened string is the negative control against inventing a finite enumeration.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_details_literals_enumerate_the_resolved_type starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The native checker must resolve these types and publish their values through the resident snapshot before details returns them; literal-only synthetic nodes cannot test that connection.
 * @evidence contracts/e2e.md#shared-execution Twenty-eight native graph entries share one project: twenty-five borrow an initialized MCP/native session, and four immutable producer assertions borrow one cached public CLI dump (the checker case uses both). Raw-only selections prepare no MCP client. Closed MCP/tag source scopes preserve original ranking/query universes; named edits advance actual generations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, chains and citation targets preserve distinctions; spec/test roles, decorators, exact/wildcard aliases, real external declarations and a physical workspace link remain. MCP/tag scopes and invalid-config recovery restore config bytes finally. The cached CLI dump serves only unchanged producer assertions; serial MCP requests synchronize named edits, and suite finally joins its owned client after full collection.
 * @evidence contracts/e2e.md#preserved-coverage Exact union and enum lists and the widened-undefined assertion are retained. This boundary case remains until actual direct semantic owners and a surviving producer batch cover those distinctions.
 */
export const test_ttscgraph_details_literals_enumerate_the_resolved_type =
  async () => {
    await withIdentityBoundary(async (client) => {
      const result = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: "Which values do these types admit?",
          request: {
            type: "details",
            handles: ["Wrapped", "Flat", "LiteralColors", "Indirect", "Widened"],
          },
        }),
      })) as ToolResult;

      const details = detailsOf(result);
      const literalsOf = (name: string): string[] | undefined =>
        details.nodes.find((node) => node.name === name)?.literals;

      const wrapped = literalsOf("Wrapped");
      const flat = literalsOf("Flat");
      const seven = ['"a"', '"b"', '"c"', '"d"', '"e"', '"f"', '"g"'];

      // The reported case: seven members, one per line, past the old six-member
      // cap and the old four-line signature window.
      assert.deepStrictEqual(
        wrapped,
        seven,
        `the wrapped union reports every member it admits: ${JSON.stringify(wrapped)}`,
      );
      // The same type, wrapped differently, is the same answer.
      assert.deepStrictEqual(
        flat,
        seven,
        `line wrapping does not change the value set: ${JSON.stringify(flat)}`,
      );
      // A multi-line enum used to report nothing: its signature stops at `{`, and
      // its members are not nodes, so `literals` is their only carrier.
      assert.deepStrictEqual(
        literalsOf("LiteralColors"),
        ['"red"', '"green"', '"blue"'],
        `the enum reports its member values: ${JSON.stringify(literalsOf("LiteralColors"))}`,
      );
      // Indirection: the seven members reaching Indirect through Wrapped are its
      // own, though no token of its declaration names them.
      assert.deepStrictEqual(
        literalsOf("Indirect"),
        [...seven, '"h"'],
        `alias indirection resolves: ${JSON.stringify(literalsOf("Indirect"))}`,
      );
      // The negative twin: this type admits every other string too, so a
      // seven-value answer would read as complete while being false.
      assert.strictEqual(
        literalsOf("Widened"),
        undefined,
        `a union widened by string reports no value set: ${JSON.stringify(literalsOf("Widened"))}`,
      );
    });
  };
