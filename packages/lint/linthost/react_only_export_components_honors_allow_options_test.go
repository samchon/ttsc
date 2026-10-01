package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactOnlyExportComponentsHonorsAllowOptions verifies react/only-export-components options.
//
// Locks the compatibility branch for frameworks that safely refresh constants
// or named route metadata. Without these options, both extra exports would be
// reported beside the component export.
//
//  1. Parse a TSX module with a component, a literal constant, and route metadata.
//  2. Enable allowConstantExport and allowExportNames.
//  3. Assert the native Engine emits no findings.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify literal answer and named metadata exports remain clean beside App when both allow options are enabled; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations allowConstantExport exempts the literal constant and allowExportNames exempts metadata, while App is a component export.
// @evidence contracts/testing.md#distinguishing-cases Two different option exemptions are active; TestReactOnlyExportComponentsReportsNonComponentExport owns the default rejection.
// @evidence contracts/testing.md#execution-ownership TestReactOnlyExportComponentsHonorsAllowOptions is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactOnlyExportComponentsHonorsAllowOptions(t *testing.T) {
  const ruleName = "react/only-export-components"
  source := `export const answer = 42;
export const metadata = { title: "Home" };
export const App = () => <main />;
`
  file := parseTSXFile(t, "/virtual/App.tsx", source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{
      ruleName: json.RawMessage(`{"allowConstantExport":true,"allowExportNames":["metadata"]}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d (%+v)", len(findings), findings)
  }
}
