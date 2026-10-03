import assert from "node:assert/strict";

import { TtscGraphApplication } from "../../../../packages/graph/src/TtscGraphApplication";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies details withdraws whole-member coverage only when its cap cuts members.
 *
 * A reduced member list cannot show the caller what was omitted. The application
 * must select the capped audit from the actual details result, while an exact
 * limit and an uncapped request retain the complete audit and member identity.
 * The audit wording also keeps the still-valid fan-out and next guidance.
 *
 * 1. Build a two-member enum through the synthetic-memory helper.
 * 2. Request uncapped, one-member and exact two-member details from the application.
 * 3. Assert returned member names, preserved identity and values, and audit selection.
 * 4. Assert the returned audit discloses the cap only when members were omitted.
 *
 * @evidence contracts/testing.md#behavioral-verification Application details returns both enum members for default and exact limit 2, only Red for limit 1, and selects an audit disclosing memberLimit only for the cut. Identity and literal values remain unchanged and next.action is answer.
 * @evidence contracts/testing.md#independent-expectations Authored enum values supply literal expected members, signatures and identity. Literal returned-audit disclosures require complete identity only for uncapped results and memberLimit for omitted members; no product audit constant supplies expectations. Native extraction is not verified.
 * @evidence contracts/testing.md#distinguishing-cases Default and exact limit 2 contrast adjacent limit 1. Returned capped audit omits the complete-member phrase, names memberLimit and retains short orientation and Follow guidance.
 * @evidence contracts/testing.md#execution-ownership Calls TtscGraphApplication, runDetails and TtscGraphMemory through createSyntheticGraph in the test process; no installed graph package, native producer or MCP host is started.
 */
export async function test_ttscgraph_details_audit_withdraws_completeness_when_capped(): Promise<void> {
    const graph = createSyntheticGraph([
      {
        id: "src/colors.ts#Colors:enum",
        kind: "enum",
        name: "Colors",
        file: "src/colors.ts",
        external: false,
        enumMembers: [
          { name: "Red", value: '"red"' },
          { name: "Blue", value: '"blue"' },
        ],
        literals: ['"red"', '"blue"'],
      },
    ]);
    const application = new TtscGraphApplication(graph);
    for (const memberLimit of [undefined, 1, 2]) {
      const output = await application.inspect_typescript_graph({
        question: "Which members belong to Colors?",
        draft: { reason: "Read the enum identity.", type: "details" },
        review: "Keep the explicit details request.",
        request: {
          type: "details",
          handles: ["Colors"],
          ...(memberLimit === undefined ? {} : { memberLimit }),
        },
      });
      assert.equal(output.result.type, "details");
      if (output.result.type !== "details")
        assert.fail("details result required");
      const node = output.result.nodes[0];
      assert.equal(output.result.nodes.length, 1);
      assert.deepEqual(output.result.unknown, []);
      assert.ok(node !== undefined);
      assert.deepEqual(
        { id: node.id, name: node.name, kind: node.kind, file: node.file },
        {
          id: "src/colors.ts#Colors:enum",
          name: "Colors",
          kind: "enum",
          file: "src/colors.ts",
        },
      );
      assert.deepEqual(node.literals, ['"red"', '"blue"']);
      assert.deepEqual(
        node.members,
        memberLimit === 1
          ? [
              {
                name: "Colors.Red",
                kind: "property",
                signature: 'Red = "red"',
              },
            ]
          : [
              { name: "Colors.Red", kind: "property", signature: 'Red = "red"' },
              { name: "Colors.Blue", kind: "property", signature: 'Blue = "blue"' },
            ],
      );
      assert.equal(output.audit.includes("memberLimit"), memberLimit === 1);
      assert.equal(output.audit.includes("members, its values, its signature"), memberLimit !== 1);
      assert.ok(output.audit.includes("short orientation"));
      assert.ok(output.audit.includes("Follow"));
      assert.equal(output.next.action, "answer");
    }
}
