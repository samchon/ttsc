package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsSkipsSingleImportFiles verifies the rule skips the
// block-level pass on empty and single-import files.
//
// Block-level sorting needs at least two items to make any rearrangement
// meaningful; firing on a single-import file would be pointless churn. The
// `len(imports) >= 2` guard exists for that reason.
//
// 1. Parse a source file with exactly one import declaration.
// 2. Run the engine with formatSortImports enabled.
// 3. Assert no block-level reorder finding fires.
//  4. Exercise the unsafe boundary and its adjacent positive.
//
// @evidence contracts/testing.md#behavioral-verification The original single-import engine result must have no block-reorder finding. Empty and singleton sources stay silent under unsafe options, while two reverse imports reorder.
// @evidence contracts/testing.md#independent-expectations Zero or one declaration has no block permutation. A literal two-declaration expected source independently defines the alphabetical unsafe order.
// @evidence contracts/testing.md#distinguishing-cases Empty, singleton and two-item boundaries distinguish insufficient block size from a permanently disabled runtime sorter. The separate named-specifier host retains single-import local sorting.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsSkipsSingleImportFiles owns its original singleton diagnostic check and the authored unsafe empty/singleton negatives plus two-item full-output positive in the selected public Go unit population. Parsing, the owning rule and fixture edit observation execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsSkipsSingleImportFiles(t *testing.T) {
  source := "import zebra from \"zebra\";\nzebra;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/sort-imports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  for _, finding := range findings {
    if finding.Message == "Imports must be sorted into canonical groups." {
      t.Fatalf("block reorder fired on single-import file: %+v", finding)
    }
  }
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`)
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", "", `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import \"./z\";\nimport \"./a\";\n", `{"unsafeSortRuntimeImports":true}`, "import \"./a\";\nimport \"./z\";\n")
}
