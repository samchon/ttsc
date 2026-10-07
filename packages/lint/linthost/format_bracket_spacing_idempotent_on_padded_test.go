package linthost

import "testing"

// TestFormatBracketSpacingIdempotentOnPadded verifies spacing:true is a no-op
// on an already-padded object literal. This direct case does not run the cascade.
//
//  1. Parse `{ x: 1 }`.
//  2. Run format/bracket-spacing with spacing:true.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must emit no finding for the already-padded single-line object when spacing:true.
// @evidence contracts/testing.md#independent-expectations The literal { x: 1 } already has the single ASCII space required on each brace interior, so the independent padding policy requires no edit.
// @evidence contracts/testing.md#distinguishing-cases This canonical-object negative complements TestFormatBracketSpacingPadsObjectLiteral and the inverse spacing:false positive; empty-object cases own the no-interior boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingIdempotentOnPadded is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal source and no-finding assertions; the shared syntax-only harness invokes the owning rule in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingIdempotentOnPadded(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/bracket-spacing",
    "const a = { x: 1 };\n",
    `{"spacing":true}`,
  )
}
