package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsSingleLineLists verifies the rule never adds a
// trailing comma to a single-line list.
//
// Comma insertion depends on the final item and closing delimiter being on different lines. Inline lists must stay unchanged even while a neighboring broken list is normalized.
//
//  1. Parse a source file with single-line array, object, and call lists.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Require silence and then normalize a neighboring broken array while
//     preserving the original inline lists.
//
// @evidence contracts/testing.md#behavioral-verification Single-line arrays, objects and call arguments must receive no findings under all mode. A neighboring multiline array must gain its final comma without changing those original lists.
// @evidence contracts/testing.md#independent-expectations Official Prettier options exclude trailing commas on single-line lists. Authored literal complete output preserves the original inline containers and changes only the added broken array.
// @evidence contracts/testing.md#distinguishing-cases The original three inline forms remain negative and a neighboring broken array is positive. SameLineCloseParen distinguishes a multiline interior with its final item and closer still on one line.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsSingleLineLists owns the direct Engine inline-list absence assertion and neighboring-array complete output in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
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
  assertFixSnapshot(t, "format/trailing-comma", "const nearby = [\n  value\n];\n"+source, "const nearby = [\n  value,\n];\n"+source)
}
