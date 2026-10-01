package linthost

import "testing"

// TestFormatOrphanSemiMergesGuardUnderNoSemi verifies that under
// semi:false a lone leading-semicolon ASI guard is pulled onto the
// statement it protects.
//
// Prettier writes `;(expr)` rather than a standalone `;` line before a
// `(`-leading statement. The rule deletes only the whitespace gap, so
// the guard keeps its indent and the statement follows on the same line.
//
//  1. Parse separated guards before parenthesis, bracket and backtick forms.
//  2. Apply format/orphan-semi with semi:false.
//  3. Assert each guard merges without changing its statement.
//  4. Require no finding when the parenthesis guard is already adjacent.
//
// @evidence contracts/testing.md#behavioral-verification The owning orphan-semi rule must delete the whitespace between an orphan guard and its parenthesis-, bracket- or template-leading statement, retaining the guard and every statement token. Full literal outputs catch deleting the semicolon or missing a hazard kind.
// @evidence contracts/testing.md#independent-expectations The supported no-semicolon guard layout keeps the leading semicolon attached to the statement it protects, matching Prettier. Literal expected outputs remove only the gap and retain call, array or template content.
// @evidence contracts/testing.md#distinguishing-cases The original parenthesis positive stays, with bracket and backtick positives added. An already adjacent parenthesis guard is a no-finding negative; sibling tests cover semi:true, comments, non-hazard successors and EOF.
// @evidence contracts/testing.md#execution-ownership TestFormatOrphanSemiMergesGuardUnderNoSemi owns all three hazard snapshots and the canonical no-finding fixture in the public Go unit population. The syntax-only owning operation and edit application run in process without installing a consumer, building native artifacts or starting a product host.
func TestFormatOrphanSemiMergesGuardUnderNoSemi(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/orphan-semi",
    "// guard\n;\n(bar as Baz).qux()\n",
    `{"semi":false}`,
    "// guard\n;(bar as Baz).qux()\n",
  )
  assertFixSnapshotWithOptions(t, "format/orphan-semi", ";\n[1, 2].forEach(visit)\n",
    `{"semi":false}`, ";[1, 2].forEach(visit)\n")
  assertFixSnapshotWithOptions(t, "format/orphan-semi", ";\n`value`\n",
    `{"semi":false}`, ";`value`\n")
  assertRuleSkipsSourceWithOptions(t, "format/orphan-semi", ";(bar as Baz).qux()\n", `{"semi":false}`)
}
