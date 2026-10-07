package linthost

import "testing"

// TestFormatOrphanSemiInertUnderSemiTrue verifies the rule does not act
// under semi:true, where the leading-semicolon guard idiom does not
// apply and dropping a redundant `;` depends on the semicolon policy.
//
//  1. Parse the same guard shape with semi:true.
//  2. Run format/orphan-semi.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning orphan-semi rule must report nothing for a separated parenthesis guard under semi:true. The absence assertion prevents applying a no-semicolon idiom when semicolon policy excludes this rule.
// @evidence contracts/testing.md#independent-expectations The supported rule scope is explicitly semi:false; under true it leaves the source untouched. This local no-finding contract is independent of the implementation option decoder and does not claim a complete formatter preserves redundant semicolons.
// @evidence contracts/testing.md#distinguishing-cases The separated parenthesis guard is a negative solely because semi is true. MergesGuardUnderNoSemi supplies the parenthesis, bracket and template positives with semi:false.
// @evidence contracts/testing.md#execution-ownership TestFormatOrphanSemiInertUnderSemiTrue owns its literal source/options and no-finding assertion in the public Go unit population. The syntax-only owning rule executes in process without consumer installation, native artifact production or a product host.
func TestFormatOrphanSemiInertUnderSemiTrue(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/orphan-semi",
    "foo();\n;\n(bar as Baz).qux();\n",
    `{"semi":true}`,
  )
}
