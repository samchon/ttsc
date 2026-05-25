package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestOnlyExportComponentsHonorsAllowOptions verifies react-refresh/only-export-components options.
//
// Locks the compatibility branch for frameworks that safely refresh constants
// or named route metadata. Without these options, both extra exports would be
// reported beside the component export.
//
//  1. Parse a TSX module with a component, a literal constant, and route metadata.
//  2. Enable allowConstantExport and allowExportNames.
//  3. Assert the native Engine emits no findings.
func TestOnlyExportComponentsHonorsAllowOptions(t *testing.T) {
  const ruleName = "react-refresh/only-export-components"
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
