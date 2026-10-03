package linthost

import "testing"

// TestFixNoUselessRenameSkipsStringLiteralAlias verifies the identifier kind
// guard of `no-useless-rename`.
//
// In an export, quoted names remain StringLiteral nodes on both sides;
// identifierText would return an empty string for each. Distinct quoted
// names must not collapse through that equality. The malformed quoted
// import local is a separate recovery case: the parser replaces its local
// name with an empty Identifier and reports an error. Neither shape is
// an equal-identifier rename, and neither may receive a destructive fix.
//
// 1. Parse a string-literal alias import the rule must not collapse.
// 2. Run the rule under the engine and confirm zero findings.
// 3. Source stays byte-identical (no destructive rebinding).
//
// @evidence contracts/testing.md#behavioral-verification no-useless-rename emits no finding for a quoted export alias or a recovered malformed quoted import local.
// @evidence contracts/testing.md#independent-expectations Distinct foo/bar export names require the alias; the malformed import is not an equal-identifier rename. Zero findings forbid destructive alias deletion.
// @evidence contracts/testing.md#distinguishing-cases The export preserves two StringLiteral nodes, whereas the import recovers an empty local Identifier; both differ from the equal-identifier positive twin. No successful compilation is certified.
// @evidence contracts/testing.md#execution-ownership TestFixNoUselessRenameSkipsStringLiteralAlias invokes assertRuleSkipsSource separately for both fixtures with the actual Engine rule, without a consumer or native host.
func TestFixNoUselessRenameSkipsStringLiteralAlias(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-useless-rename",
    "import { \"foo\" as \"bar\" } from \"./mod\";\nJSON.stringify(\"bar\");\n",
  )
  assertRuleSkipsSource(
    t,
    "no-useless-rename",
    "const foo = 1;\nexport { \"foo\" as \"bar\" };\n",
  )
}
