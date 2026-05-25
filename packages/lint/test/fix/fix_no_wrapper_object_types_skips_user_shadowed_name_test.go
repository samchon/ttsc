package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsUserShadowedName verifies the round-2
// shadow-bailout for `noWrapperObjectTypes`.
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
func TestFixNoWrapperObjectTypesSkipsUserShadowedName(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "noWrapperObjectTypes",
    "type String = { length: number };\ndeclare const v: String;\nJSON.stringify(v.length);\n",
  )
}
