package linthost

import "testing"

// TestFormatBracketSpacingPadsMappedType verifies mapped types participate in
// the same inner-brace spacing policy as ordinary type literals.
//
// A mapped type has a distinct syntax kind, so visiting TypeLiteral alone
// could never reach its braces.
//
// 1. Parse an unpadded mapped type.
// 2. Apply format/bracket-spacing with spacing enabled.
// 3. Assert exactly one space appears inside each brace.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must pad the distinct mapped-type brace surface without changing the key iteration or indexed value type.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves K in keyof T and T[K] and adds only the brace padding required by spacing:true.
// @evidence contracts/testing.md#distinguishing-cases This mapped-type positive is distinct from ordinary type literals and object bindings; the canonical type-literal negative owns an already-spaced case under the same policy.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsMappedType is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingPadsMappedType(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "type M<T> = {[K in keyof T]: T[K]};\n",
    `{"spacing":true}`,
    "type M<T> = { [K in keyof T]: T[K] };\n",
  )
}
