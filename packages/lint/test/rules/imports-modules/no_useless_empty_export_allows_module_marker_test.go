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
//
// @evidence contracts/testing.md#behavioral-verification Engine leaves export {} clean when it is the only module marker in a file.
// @evidence contracts/testing.md#independent-expectations An otherwise script-like source needs that export to establish module scope; zero findings follows the module-marker contract.
// @evidence contracts/testing.md#distinguishing-cases Empty export is necessary here; TestRuleCorpusNoUselessEmptyExport owns the same syntax after another export already establishes module scope.
// @evidence contracts/testing.md#execution-ownership parseTS creates the authored module-marker AST and NewEngine.Run executes typescript/no-useless-empty-export directly. The Test owns its zero-finding result in the Go process.
func TestNoUselessEmptyExportAllowsModuleMarker(t *testing.T) {
  file := parseTS(t, "export {};\nconst local = 1;\nJSON.stringify(local);\n")
  findings := NewEngine(RuleConfig{"typescript/no-useless-empty-export": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected no findings, got %v", findingRules(findings))
  }
}
