package linthost

import "testing"

// TestFixNoUselessRenameSkipsStringLiteralAlias verifies the round-2
// kind-guard repair for `noUselessRename`.
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
func TestFixNoUselessRenameSkipsStringLiteralAlias(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "noUselessRename",
    "import { \"foo\" as \"bar\" } from \"./mod\";\nJSON.stringify(\"bar\");\n",
  )
}
