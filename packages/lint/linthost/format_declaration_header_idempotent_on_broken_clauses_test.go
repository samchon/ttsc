package linthost

import "testing"

// TestFormatDeclarationHeaderIdempotentOnBrokenClauses verifies the rule
// reports no finding for an already-correct multi-clause header. This direct
// canonical-input case does not run or certify the complete cascade.
//
//  1. Parse a class header already in the Prettier multi-clause shape.
//  2. Run format/declaration-header at printWidth 50.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must emit no finding for the correctly broken extends/implements class header at width fifty.
// @evidence contracts/testing.md#independent-expectations The independently authored canonical literal retains Base, four interfaces and the body; no prior implementation output is used to build this input.
// @evidence contracts/testing.md#distinguishing-cases This canonical no-op is paired with the flat-to-broken multi-clause transformation; together they distinguish convergence from an unconditional no-op.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderIdempotentOnBrokenClauses is selected by the lint semantic-unit Evidence claim as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and observes zero findings without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderIdempotentOnBrokenClauses(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "class C\n  extends Base\n  implements First, Second, Third, Fourth\n{\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
