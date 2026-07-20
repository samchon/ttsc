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
func TestFormatBracketSpacingPadsMappedType(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "type M<T> = {[K in keyof T]: T[K]};\n",
    `{"spacing":true}`,
    "type M<T> = { [K in keyof T]: T[K] };\n",
  )
}
