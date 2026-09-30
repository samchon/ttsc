import assert from "node:assert/strict";

import { TtscGraphApplication } from "../../../../packages/graph/src/TtscGraphApplication";
import {
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_DETAILS_CAPPED,
} from "../../../../packages/graph/src/server/resultAudit";

import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies details withdraws whole-member coverage only when its cap cuts members.
 *
 * A reduced member list cannot show the caller what was omitted. The application
 * must select the capped audit from the actual details result, while an exact
 * limit and an uncapped request retain the complete audit and member identity.
 * The public audit wording also keeps the still-valid fan-out and next guidance.
 *
 * 1. Build a two-member enum through the authored synthetic-memory helper.
 * 2. Request uncapped, one-member and exact two-member details from the application.
 * 3. Assert returned member names, preserved identity and values, and audit selection.
 * 4. Retain the literal public-wording assertions for complete and capped audits.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphApplication.inspect_typescript_graph runs the real details projection over a two-member enum; a one-member cap changes both the returned members and selected audit, while the exact limit retains both members and the complete audit.
 * @evidence contracts/testing.md#independent-expectations The fixture declares Red and Blue with literal values; literal expected member pairs and retained identity derive from those inputs, while distinct audit constants and the original public wording checks expose an incorrect completeness claim. This case does not verify native enum extraction.
 * @evidence contracts/testing.md#distinguishing-cases Default and exact-limit requests return both enum members under the complete audit; the adjacent limit of one omits Blue and selects the capped audit without changing identity, values or answer continuation. Original capped wording exclusion and retained guidance assertions remain.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit test_ttscgraph_details_audit_withdraws_completeness_when_capped export is selected by the source-unit runner and calls authored application, details and memory code in its Node process; no installed graph package, native producer or MCP host is started.
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
      assert.equal(
        output.audit,
        memberLimit === 1 ? RESULT_AUDIT_DETAILS_CAPPED : RESULT_AUDIT_DETAILS,
      );
      assert.equal(output.next.action, "answer");
    }

    assert.notEqual(
      RESULT_AUDIT_DETAILS_CAPPED,
      RESULT_AUDIT_DETAILS,
      "the capped audit must actually differ from the uncapped one",
    );
    assert.ok(
      RESULT_AUDIT_DETAILS.includes("its signature — is complete"),
      "the uncapped audit still claims a complete identity",
    );
    assert.ok(
      !RESULT_AUDIT_DETAILS_CAPPED.includes(
        "members, its values, its signature — is complete",
      ),
      `the capped audit still claims complete members:\n${RESULT_AUDIT_DETAILS_CAPPED}`,
    );
    assert.ok(
      RESULT_AUDIT_DETAILS_CAPPED.includes("memberLimit"),
      "the capped audit names the cap the caller asked for",
    );
    for (const kept of ["short orientation", "Follow"])
      assert.ok(
        RESULT_AUDIT_DETAILS_CAPPED.includes(kept),
        `the capped audit dropped a half that is still true: ${kept}`,
      );
}
