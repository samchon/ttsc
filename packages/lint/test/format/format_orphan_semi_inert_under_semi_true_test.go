package linthost

import "testing"

// TestFormatOrphanSemiInertUnderSemiTrue verifies the rule does not act
// under semi:true, where the leading-semicolon guard idiom does not
// apply and dropping a redundant `;` depends on the semicolon policy.
//
//  1. Parse the same guard shape with semi:true.
//  2. Run format/orphan-semi.
//  3. Assert the rule reports nothing.
func TestFormatOrphanSemiInertUnderSemiTrue(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/orphan-semi",
    "foo();\n;\n(bar as Baz).qux();\n",
    `{"semi":true}`,
  )
}
