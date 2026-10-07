package linthost

import "testing"

// TestFormatArrowParensIdempotentOnWrapped verifies prefer:"always" is a
// no-op on an already-parenthesized single parameter. This observes the rule's
// canonical input, not convergence of a complete multi-rule fix cascade.
//
//  1. Parse `(x) => x`.
//  2. Run format/arrow-parens with prefer:"always".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must offer no additional edit for an already-wrapped identifier parameter under always, preventing repeated wrapping.
// @evidence contracts/testing.md#independent-expectations The literal (x) already satisfies the always policy; zero findings is a specified canonical-form result rather than output copied from a previous implementation run.
// @evidence contracts/testing.md#distinguishing-cases This unchanged canonical singleton complements the actual bare-to-wrapped positive case, so idempotency is not the only correctness oracle.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensIdempotentOnWrapped is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensIdempotentOnWrapped(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/arrow-parens",
    "const a = (x) => x;\n",
    `{"prefer":"always"}`,
  )
}
