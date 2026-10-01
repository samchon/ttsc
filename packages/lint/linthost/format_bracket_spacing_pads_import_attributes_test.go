package linthost

import "testing"

// TestFormatBracketSpacingPadsImportAttributes verifies import attributes use
// the configured inner-brace spacing policy.
//
// ImportAttributes starts at `with`, rather than its opening brace. The rule
// must locate the brace range inside that node instead of assuming node.Pos is
// the brace itself.
//
// 1. Parse an import attribute clause without inner padding.
// 2. Apply format/bracket-spacing with spacing enabled.
// 3. Assert exactly one space appears inside the attribute braces.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must locate and pad the import-attribute braces even though their AST node starts at with.
// @evidence contracts/testing.md#independent-expectations The full literal output preserves the default import, module string and type:"json" attribute and inserts only the two spaces demanded by spacing:true.
// @evidence contracts/testing.md#distinguishing-cases This import-attribute positive catches confusing node start with brace start; named-import padding owns the other import brace surface, while already-padded negatives distinguish no-op behavior.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsImportAttributes is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingPadsImportAttributes(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "import data from \"data\" with {type: \"json\"};\n",
    `{"spacing":true}`,
    "import data from \"data\" with { type: \"json\" };\n",
  )
}
