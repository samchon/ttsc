package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsUserShadowedName verifies the shadow
// bailout of `no-wrapper-object-types` for a local type alias.
//
// The fixture introduces a structural type alias named String rather than
// spelling a primitive type. The guard recognizes that file-scope type
// declaration and suppresses reporting; this parser-only fixture does not
// certify successful compilation alongside the standard library.
//
// 1. Parse a source file that shadows `String` with a local type alias.
// 2. Run the rule under the engine and confirm zero findings.
// 3. The user's String type survives byte-for-byte.
//
// @evidence contracts/testing.md#behavioral-verification The wrapper-type rule emits no finding for a local String type alias.
// @evidence contracts/testing.md#independent-expectations The independent structural type alias and zero findings prohibit replacing that user-defined type with the global primitive.
// @evidence contracts/testing.md#distinguishing-cases User type-space shadowing differs from genuine global String; other shadow syntaxes have separate tests.
// @evidence contracts/testing.md#execution-ownership TestFixNoWrapperObjectTypesSkipsUserShadowedName calls assertRuleSkipsSource with the local type alias.
func TestFixNoWrapperObjectTypesSkipsUserShadowedName(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "type String = { length: number };\ndeclare const v: String;\nJSON.stringify(v.length);\n",
  )
}
