package linthost

import "testing"

// TestFormatOrphanSemiSkipsNonHazardSuccessor verifies format/orphan-semi
// leaves a standalone `;` alone when the next statement does not open with
// an ASI-hazard token. The rule only glues a leading-semicolon guard onto
// the statement it protects (one starting with `(`, `[`, or a backtick);
// a `const` after the `;` is no guard, so merging would be wrong.
//
//  1. Parse a standalone `;` followed by a `const` declaration.
//  2. Run format/orphan-semi under semi:false.
//  3. Assert the rule reports nothing.
func TestFormatOrphanSemiSkipsNonHazardSuccessor(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/orphan-semi",
    ";\nconst a = 1;\n",
    `{"semi":false}`,
  )
}
