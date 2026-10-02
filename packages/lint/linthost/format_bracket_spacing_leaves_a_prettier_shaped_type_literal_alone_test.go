package linthost

import "testing"

// TestFormatBracketSpacingLeavesAPrettierShapedTypeLiteralAlone verifies the
// same type literal in Prettier's own shape produces no edit.
//
// The negative twin of the unspaced pad, and the fixed-point half of the
// guide's claim: a file already formatted by Prettier must come out
// byte-identical. Without it, the pad case alone would still pass if the rule
// rewrote every type literal it saw.
//
//  1. Parse the Prettier 3.8.3 output for the same declaration.
//  2. Run format/bracket-spacing with spacing:true.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must leave the padded alpha/bravo type literal without findings under spacing:true.
// @evidence contracts/testing.md#independent-expectations The literal type declaration already satisfies the supported brace-padding policy and matches the independently obtained Prettier 3.8.3 shape; no edit is required.
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
