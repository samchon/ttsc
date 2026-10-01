package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsUserShadowedName verifies the round-2
// shadow-bailout for `no-wrapper-object-types`.
//
// Pre-repair, when a file declared its own `type String = { length:
// number }`, the rule still fired on the `String` reference and the fix
// rewrote it to the lowercase primitive — changing the type. The repair
// scans top-level statements for a same-name TypeAliasDeclaration,
// InterfaceDeclaration, or ClassDeclaration and bails entirely when one
// is present.
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
