package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestPreferAsConstVariableAnnotationOffersExactSuggestion verifies the
// declaration rewrite is manual, complete, and trivia-safe.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const offers exactly two manual edits moving the variable literal annotation into as const.
// @evidence contracts/testing.md#independent-expectations The literal rewritten declaration preserves before/marker/after comments and trailing use; no autofix and one suggestion specify explicit user choice.
// @evidence contracts/testing.md#distinguishing-cases Variable declaration annotation is manual rather than automatic expression assertion; type parentheses are removed without deleting adjacent source.
// @evidence contracts/testing.md#execution-ownership TestPreferAsConstVariableAnnotationOffersExactSuggestion calls parseTS, NewEngine.Run and applyFindingFixesToText on its literal value declaration in process.
func TestPreferAsConstVariableAnnotationOffersExactSuggestion(t *testing.T) {
  source := "let /* before */ value /* marker */: (\"literal\") = \"literal\" /* after */;\nJSON.stringify(value);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"typescript/prefer-as-const": SeverityError}).Run(
    []*shimast.SourceFile{file},
    nil,
  )
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1", len(findings))
  }
  finding := findings[0]
  if len(finding.Fix) != 0 || len(finding.Suggestions) != 1 {
    t.Fatalf("fixes = %d, suggestions = %d", len(finding.Fix), len(finding.Suggestions))
  }
  rewritten, applied := applyFindingFixesToText(
    source,
    []*Finding{{Fix: finding.Suggestions[0].Edits}},
  )
  if applied != 2 {
    t.Fatalf("applied edits = %d, want 2", applied)
  }
  expected := "let /* before */ value /* marker */ = \"literal\" as const /* after */;\nJSON.stringify(value);\n"
  if rewritten != expected {
    t.Fatalf("suggested source mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
}
