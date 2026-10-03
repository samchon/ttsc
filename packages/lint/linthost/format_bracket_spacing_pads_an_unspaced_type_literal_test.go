package linthost

import "testing"

// TestFormatBracketSpacingPadsAnUnspacedTypeLiteral verifies the pad is applied
// while retaining the unspaced member tokens inside it.
//
// The rule trims only exterior trivia and pads the remaining interior as one
// string. It does not rewrite the member colons or separator. This case owns
// that partial-normalization boundary, not a claim about every formatter rule
// or an external formatter's output.
//
//  1. Parse a type literal with neither brace padding nor interior spacing.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert the braces gain their padding and the interior is untouched.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must pad the outer braces of the unspaced type literal while retaining its alpha:number;bravo:string interior exactly.
// @evidence contracts/testing.md#independent-expectations The full literal output follows this rule's supported partial-normalization boundary: only brace-adjacent spaces change, and both member names and types remain intact. It is deliberately not a claim of complete Prettier normalization.
// @evidence contracts/testing.md#distinguishing-cases This unpadded type-literal positive complements the independently padded type-literal negative; object and mapped-type positives own distinct AST surfaces for the same brace policy.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsAnUnspacedTypeLiteral is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingPadsAnUnspacedTypeLiteral(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "export type J = {alpha:number;bravo:string};\n",
    `{"spacing":true}`,
    "export type J = { alpha:number;bravo:string };\n",
  )
}
