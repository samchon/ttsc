package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsSingleLineLists verifies the rule never adds a
// trailing comma when the list fits on one line.
//
// Single-line lists are the "before" picture of prettier's behavior: leaving
// them alone is the whole point of the "trailingComma: 'all'" choice (the
// docs explicitly mention this). Pinning the negative branch keeps the
// rule from regressing into an over-eager rewriter that would defeat the
// readability gain.
//
// 1. Parse a source file with single-line array, object, and call lists.
// 2. Run the engine with formatTrailingComma enabled.
// 3. Assert zero findings.
func TestFormatTrailingCommaSkipsSingleLineLists(t *testing.T) {
  source := "const xs = [1, 2, 3];\n" +
    "const obj = { a: 1, b: 2 };\n" +
    "JSON.stringify({ a: 1, b: 2 }, null, 2);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
