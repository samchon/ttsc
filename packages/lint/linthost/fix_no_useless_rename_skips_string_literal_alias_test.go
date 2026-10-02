package linthost

import "testing"

// TestFixNoUselessRenameSkipsStringLiteralAlias verifies the identifier kind
// guard of `no-useless-rename`.
//
// Pre-repair, `import { "foo" as "bar" } from "./mod"` triggered the rule
// because both PropertyName and Name are StringLiteral nodes and
// `identifierText` returned `""` for both, collapsing the equality guard
// to `"" == ""`. The fix then deleted ` as "bar"` and rebound the local
// symbol — real source corruption. The repair refuses to fire unless
// both sides are KindIdentifier.
//
// 1. Parse a string-literal alias import the rule must not collapse.
// 2. Run the rule under the engine and confirm zero findings.
// 3. Source stays byte-identical (no destructive rebinding).
//
// @evidence contracts/testing.md#behavioral-verification no-useless-rename emits no finding for a string-literal foo-to-bar alias instead of treating both names as empty identifiers.
// @evidence contracts/testing.md#independent-expectations The independent foo/bar literal inputs denote distinct names; zero findings forbid deleting the alias and rebinding it.
// @evidence contracts/testing.md#distinguishing-cases String-literal name kinds differ from the equal identifier foo-as-foo positive twin; the fixture tests parser-level recognition, not successful compilation.
// @evidence contracts/testing.md#execution-ownership TestFixNoUselessRenameSkipsStringLiteralAlias invokes assertRuleSkipsSource for the actual Engine rule without a consumer or native host.
func TestFixNoUselessRenameSkipsStringLiteralAlias(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-useless-rename",
    "import { \"foo\" as \"bar\" } from \"./mod\";\nJSON.stringify(\"bar\");\n",
  )
}
