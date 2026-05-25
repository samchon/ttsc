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
//  1. Parse a source file with sorted external + relative groups and a
//     blank-line separator.
//  2. Run the engine with formatSortImports enabled.
//  3. Assert zero findings.
func TestFormatSortImportsSkipsAlreadySortedFiles(t *testing.T) {
  source := "import alpha from \"alpha\";\n" +
    "import zebra from \"zebra\";\n" +
    "\n" +
    "import { x } from \"./local-a\";\n" +
    "import { reduce } from \"./local-b\";\n" +
    "JSON.stringify({ alpha, zebra, x, reduce });\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"formatSortImports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
