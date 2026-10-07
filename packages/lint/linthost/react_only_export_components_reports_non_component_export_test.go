package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactOnlyExportComponentsReportsNonComponentExport verifies react/only-export-components.
//
// Locks the React Fast Refresh module-boundary branch where a TSX file already
// exports a component alongside a non-component value under the default policy.
// The rule points at the shared value; this unit does not execute a refresh runtime.
//
//  1. Parse a TSX module with one component export and one value export.
//  2. Run only react/only-export-components.
//  3. Assert the native Engine reports the non-component export line.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify version export reports at line 1 beside a component; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Default refresh-boundary policy rejects a non-component value sharing a component module.
// @evidence contracts/testing.md#distinguishing-cases The value and component share one module, but only the value reports; the allow-options case owns exceptions.
// @evidence contracts/testing.md#execution-ownership TestReactOnlyExportComponentsReportsNonComponentExport is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactOnlyExportComponentsReportsNonComponentExport(t *testing.T) {
  const ruleName = "react/only-export-components"
  source := `export const version = "1.0.0";
export function App() {
  return <main />;
}
`
  file := parseTSXFile(t, "/virtual/App.tsx", source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{ruleName: SeverityError}, findings); err != nil {
    t.Fatalf("invalid React findings: %v", err)
  }
  actual := normalizeRuleFindings(file, findings)
  expected := ruleExpectation{Rule: ruleName, Severity: SeverityError, Line: 1}
  if len(actual) != 1 || actual[0] != expected {
    t.Fatalf("want %v, got %v", []ruleExpectation{expected}, actual)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
