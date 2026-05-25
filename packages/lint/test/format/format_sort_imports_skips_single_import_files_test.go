package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsSkipsSingleImportFiles verifies the rule skips the
// block-level pass on files with one or zero imports.
//
// Block-level sorting needs at least two items to make any rearrangement
// meaningful; firing on a single-import file would be pointless churn. The
// `len(imports) >= 2` guard exists for that reason.
//
// 1. Parse a source file with exactly one import declaration.
// 2. Run the engine with formatSortImports enabled.
// 3. Assert no block-level reorder finding fires.
func TestFormatSortImportsSkipsSingleImportFiles(t *testing.T) {
  source := "import zebra from \"zebra\";\nzebra;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"formatSortImports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  for _, finding := range findings {
    if finding.Message == "Imports must be sorted into canonical groups." {
      t.Fatalf("block reorder fired on single-import file: %+v", finding)
    }
  }
}
