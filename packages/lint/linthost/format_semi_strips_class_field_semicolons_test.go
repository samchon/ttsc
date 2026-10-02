package linthost

import "testing"

// TestFormatSemiStripsClassFieldSemicolons verifies semi:false removes
// the trailing `;` from newline-separated class fields.
//
// Class fields carry the full expression-ASI hazard set because their
// initializer is an expression, but plain identifier-named fields
// followed by another field (or `}`) are safe. Prettier drops their
// terminators under semi:false.
//
//  1. Parse a class with two semicolon-terminated fields.
//  2. Apply format/semi with prefer:"never".
//  3. Assert both field terminators are removed.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove safe semicolons from both ordinary newline-separated class fields under never while preserving their names and one/two initializers.
// @evidence contracts/testing.md#independent-expectations The independently authored class output follows safe field ASI and preserves both field expressions; only their optional trailing semicolons disappear.
// @evidence contracts/testing.md#distinguishing-cases The changed ordinary field pair contrasts with the computed-member hazard case, where the first field terminator must remain and the last can still change.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiStripsClassFieldSemicolons is a selected public Go unit under the lint semantic-unit Evidence claim. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiStripsClassFieldSemicolons(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "class A {\n  a = 1;\n  b = 2;\n}\n",
    `{"prefer":"never"}`,
    "class A {\n  a = 1\n  b = 2\n}\n",
  )
}
