package linthost

import "testing"

// TestFormatOrphanSemiSkipsNonHazardSuccessor verifies format/orphan-semi
// leaves a standalone `;` alone when the next statement does not open with
// an ASI-hazard token. The rule only glues a leading-semicolon guard onto
// the statement it protects (one starting with `(`, `[`, or a backtick);
// a `const` after the `;` is no guard, so merging would be wrong.
//
//  1. Parse a standalone semicolon followed by const or by EOF, with
//     and without a final newline.
//  2. Run format/orphan-semi under semi:false.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning orphan-semi rule must report nothing for a const successor or an orphan semicolon at EOF. These assertions prevent merging unrelated statements or reporting an edit without any statement to protect.
// @evidence contracts/testing.md#independent-expectations The supported guard merge requires a following parenthesis, bracket or backtick hazard. A const declaration and EOF have none, so unchanged source is required independently of the implementation byte switch.
// @evidence contracts/testing.md#distinguishing-cases The original const-successor negative stays. Semicolon-plus-newline EOF and bare-semicolon EOF exercise both empty-successor boundaries; the merge host supplies all three actual hazard positives.
// @evidence contracts/testing.md#execution-ownership TestFormatOrphanSemiSkipsNonHazardSuccessor owns the non-hazard and two EOF fixtures in the public Go unit population. The syntax-only owning rule executes in process without consumer installation, native artifact production or starting a product host.
func TestFormatOrphanSemiSkipsNonHazardSuccessor(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/orphan-semi",
    ";\nconst a = 1;\n",
    `{"semi":false}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/orphan-semi", ";\n", `{"semi":false}`)
  assertRuleSkipsSourceWithOptions(t, "format/orphan-semi", ";", `{"semi":false}`)
}
