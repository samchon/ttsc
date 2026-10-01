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
 * The audit wording also keeps the still-valid fan-out and next guidance.
 *
 * 1. Build a two-member enum through the synthetic-memory helper.
 * 2. Request uncapped, one-member and exact two-member details from the application.
 * 3. Assert returned member names, preserved identity and values, and audit selection.
 * 4. Assert literal substrings of the complete and capped audit texts.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphApplication.inspect_typescript_graph must run the real details projection over a two-member enum: with no memberLimit and with memberLimit 2 it returns both members and RESULT_AUDIT_DETAILS, while memberLimit 1 returns only Colors.Red and RESULT_AUDIT_DETAILS_CAPPED; id, name, kind, file and literals are unchanged in every case and next.action stays "answer".
 * @evidence contracts/testing.md#independent-expectations The fixture declares Red and Blue with literal values, and the expected member names, signatures and identity are literals derived from those inputs. The audit selection is compared with the product's own two audit constants, and the wording checks assert literal substrings of them; native enum extraction is not verified.
 * @evidence contracts/testing.md#distinguishing-cases Default and exact-limit requests (both members, complete audit) contrast the adjacent limit of one (Blue omitted, capped audit). The capped text must differ from the complete text, no longer contain the complete-members sentence, mention memberLimit, and keep the substrings "short orientation" and "Follow".
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
