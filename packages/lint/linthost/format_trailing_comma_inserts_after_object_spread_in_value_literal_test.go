package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterObjectSpreadInValueLiteral is the
// over-suppression twin of the object rest-target skip: a real object VALUE
// literal ending in a spread (`{ a, ...o }`) legally takes a trailing comma.
//
// Object value spread and object assignment rest share an AST shape but different comma grammar. This positive prevents a rest-target guard from suppressing all object spreads.
//
// 1. Parse a multi-line object value literal whose last member is a spread.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the trailing comma lands after the spread.
//
// @evidence contracts/testing.md#behavioral-verification The value object must gain a comma after spread o while retaining shorthand a and its order. Full output detects treating every spread assignment as prohibited rest syntax.
// @evidence contracts/testing.md#independent-expectations ECMAScript object-initializer grammar permits a final comma after a spread property. The authored literal expected object independently preserves the copied properties; this direct unit does not execute a reference formatter.
// @evidence contracts/testing.md#distinguishing-cases The value spread is positive, contrasting SkipsObjectRestAssignmentTarget. NonRestObjectAssignmentTarget distinguishes legal destructuring targets from targets ending in rest.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterObjectSpreadInValueLiteral owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaInsertsAfterObjectSpreadInValueLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const merged = {\n  a,\n  ...o\n};\n",
    "const merged = {\n  a,\n  ...o,\n};\n",
  )
}
