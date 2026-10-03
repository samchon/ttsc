package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsSkipsAlreadySortedFiles verifies idempotence.
//
// Sort rules are particularly prone to oscillation: a buggy comparator that
// is not stable can swap equal-key items every other pass and burn the
// format loop's cap. The rule must produce zero findings on a file whose
// imports and specifiers are already canonical.
//
//  1. Parse a source file with sorted third-party + relative groups laid out
//     in the default order (no blank-line separator).
//  2. Run the engine with formatSortImports enabled.
//  3. Assert zero findings.
//  4. Exercise the unsafe boundary and its adjacent positive.
//
// @evidence contracts/testing.md#behavioral-verification The canonical alpha/zebra then local-a/local-b declarations must emit no findings under both default and unsafe options; reverse bare-import order must change under unsafe options.
// @evidence contracts/testing.md#independent-expectations The literal canonical source follows the supported default third-party-before-relative grouping and alphabetical order. The separate two-import output fixes the permitted lexical order without deriving it from the comparator.
// @evidence contracts/testing.md#distinguishing-cases Default mode alone would hide sorting defects in this runtime block. Its unsafe fixed point isolates canonicality, while an unsafe reverse-order positive distinguishes a rule that never acts.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsSkipsAlreadySortedFiles owns its original engine zero-finding assertion plus unsafe canonical and reverse-order literal cases in the selected public Go unit population. Parsing, the owning rule and fixture edit observation execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsSkipsAlreadySortedFiles(t *testing.T) {
  source := "import alpha from \"alpha\";\n" +
    "import zebra from \"zebra\";\n" +
    "import { x } from \"./local-a\";\n" +
    "import { reduce } from \"./local-b\";\n" +
    "JSON.stringify({ alpha, zebra, x, reduce });\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/sort-imports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import \"./z\";\nimport \"./a\";\n", `{"unsafeSortRuntimeImports":true}`, "import \"./a\";\nimport \"./z\";\n")
}
