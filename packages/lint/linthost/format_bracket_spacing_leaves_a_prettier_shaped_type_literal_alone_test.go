package linthost

import "testing"

// TestFormatBracketSpacingLeavesAPrettierShapedTypeLiteralAlone verifies the
// padded type literal produces no finding under the supported spacing policy.
//
// This is the negative twin of the unspaced pad. The positive alone would still
// pass if the rule rewrote every type literal it saw. The literal is an
// independent padding expectation, not a recorded external formatter result.
//
//  1. Parse the independently authored padded type declaration.
//  2. Run format/bracket-spacing with spacing:true.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must leave the padded alpha/bravo type literal without findings under spacing:true.
// @evidence contracts/testing.md#independent-expectations The independently authored literal type declaration already satisfies the supported brace-padding policy; no edit is required. This body does not obtain or compare external formatter output.
// @evidence contracts/testing.md#distinguishing-cases This canonical type-literal negative complements the unspaced type-literal positive, distinguishing an already-padded interior from an unpadded one without claiming this single rule formats every token.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingLeavesAPrettierShapedTypeLiteralAlone is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal source and no-finding assertions; the shared syntax-only harness invokes the owning rule in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingLeavesAPrettierShapedTypeLiteralAlone(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/bracket-spacing",
    "export type J = { alpha: number; bravo: string };\n",
    `{"spacing":true}`,
  )
}
