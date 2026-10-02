import assert from "node:assert/strict";

import {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_DETAILS_CAPPED,
  RESULT_AUDIT_ESCAPE,
  RESULT_AUDIT_SELECTION,
} from "../../../../packages/graph/src/server/resultAudit";

/**
 * Verifies every audit that vouches for graph facts also names the structure the
 * server derives and the artifact kinds a plugin publishes.
 *
 * An audit that says the compiler resolved the facts must disclose what it did
 * not resolve, or it claims more than was checked. The escape audit carries no
 * facts and must not vouch for any.
 *
 * 1. Take the trace/overview, selection, details and capped-details audits.
 * 2. Require each to name `file`, `contains`, `dispatches`, `property`, the
 *    `test` role and each of the six artifact kinds, written here as literals.
 * 3. Require the escape audit to name none of them.
 *
 * @evidence contracts/testing.md#behavioral-verification RESULT_AUDIT, RESULT_AUDIT_SELECTION, RESULT_AUDIT_DETAILS and RESULT_AUDIT_DETAILS_CAPPED must each contain the backticked names file, contains, dispatches, property, test and the six artifact kinds markdown_document, markdown_section, prisma_model, prisma_column, prisma_relation and swagger_operation, and RESULT_AUDIT_ESCAPE must contain none of them.
 * @evidence contracts/testing.md#independent-expectations The names are literals written from the memory layer's derived structure and the published artifact vocabulary, not read from TTSC_GRAPH_ARTIFACT_NODE_KINDS, so a kind added to the vocabulary without the audit fails the sibling vocabulary only if this list is updated with it; that gap is stated, not hidden.
 * @evidence contracts/testing.md#distinguishing-cases Four audits that vouch for facts are positives; the escape audit, which vouches for none, is the negative; the capped details audit is a derived text and is checked because its rewrite could drop the disclosure. Whether the disclosed names are true of the data is owned by the trace and impact units.
 * @evidence contracts/testing.md#execution-ownership The src/features export reads the exported audit strings in the unit process; no application, session or host is started.
 */
export function test_ttscgraph_every_audit_names_the_facts_the_compiler_did_not_resolve(): void {
  const names = [
    "file",
    "contains",
    "dispatches",
    "property",
    "test",
    "markdown_document",
    "markdown_section",
    "prisma_model",
    "prisma_column",
    "prisma_relation",
    "swagger_operation",
  ];
  const failures: unknown[] = [];
  for (const [label, audit] of [
    ["RESULT_AUDIT", RESULT_AUDIT],
    ["RESULT_AUDIT_SELECTION", RESULT_AUDIT_SELECTION],
    ["RESULT_AUDIT_DETAILS", RESULT_AUDIT_DETAILS],
    ["RESULT_AUDIT_DETAILS_CAPPED", RESULT_AUDIT_DETAILS_CAPPED],
  ] as const)
    for (const name of names)
      try {
        assert.ok(audit.includes(`\`${name}\``), `${label} does not name \`${name}\``);
      } catch (error) {
        failures.push(error);
      }
  for (const name of names)
    try {
      assert.ok(!RESULT_AUDIT_ESCAPE.includes(name), `the escape audit names ${name}`);
    } catch (error) {
      failures.push(error);
    }
  if (failures.length) throw new AggregateError(failures, "audit disclosure");
}
