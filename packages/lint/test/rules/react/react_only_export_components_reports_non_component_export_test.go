package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactOnlyExportComponentsReportsNonComponentExport verifies react/only-export-components.
//
// Locks the React Fast Refresh module-boundary branch where a TSX file already
// exports a component and then adds a non-component export. That mixed export
// shape forces refresh invalidation, so the rule must point at the shared value.
//
//  1. Parse a TSX module with one component export and one value export.
//  2. Run only react/only-export-components.
//  3. Assert the native Engine reports the non-component export line.
func TestReactOnlyExportComponentsReportsNonComponentExport(t *testing.T) {
  const ruleName = "react/only-export-components"
  source := `export const version = "1.0.0";
export function App() {
  return <main />;
}
`
  file := parseTSXFile(t, "/virtual/App.tsx", source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := ruleExpectation{Rule: ruleName, Severity: SeverityError, Line: 1}
  if len(actual) != 1 || actual[0] != expected {
    t.Fatalf("want %v, got %v", []ruleExpectation{expected}, actual)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
