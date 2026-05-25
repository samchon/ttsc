package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEmptyExportAllowsModuleMarker verifies export-empty remains legal as a module marker.
//
// The rule must not flag a standalone `export {}` because that syntax can be
// the only reason a script is treated as a module. This pins the negative path
// that the corpus helper cannot express without an expected diagnostic.
//
// 1. Parse a file containing only an empty export and a value use.
// 2. Enable `no-useless-empty-export`.
// 3. Assert the native Engine reports no diagnostics.
func TestNoUselessEmptyExportAllowsModuleMarker(t *testing.T) {
  file := parseTS(t, "export {};\nconst local = 1;\nJSON.stringify(local);\n")
  findings := NewEngine(RuleConfig{"no-useless-empty-export": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected no findings, got %v", findingRules(findings))
  }
}
