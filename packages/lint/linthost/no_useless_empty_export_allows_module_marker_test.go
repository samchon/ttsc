package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEmptyExportAllowsModuleMarker verifies `export {}` stays legal
// when it is the only module syntax in the file.
//
// The rule must not flag a standalone `export {}` because that syntax can be the
// only reason a script is treated as a module.
//
// 1. Parse a file containing only an empty export and a value use.
// 2. Build an engine with `typescript/no-useless-empty-export` at error severity.
// 3. Require the engine to bind the rule, then require zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run over the parsed source yields no finding for the sole `export {}`, and the Test first requires the engine to have no ConfigError and to have the rule enabled at error severity, so the empty result is not caused by an unbound rule.
// @evidence contracts/testing.md#independent-expectations The source has no other import or export, so the empty export is what makes the file a module; zero findings follows from the module-marker contract in the rule documentation.
// @evidence contracts/testing.md#distinguishing-cases This Test is the negative case: the empty export is the only module syntax. The positive case, an empty export beside `export const marker`, is carried by the shared corpus fixture test/testdata/corpus/no-useless-empty-export.ts.
// @evidence contracts/testing.md#execution-ownership parseTS creates the AST and NewEngine(...).Run executes the rule in the Go test process. No project, checker or native host is involved.
func TestNoUselessEmptyExportAllowsModuleMarker(t *testing.T) {
  file := parseTS(t, "export {};\nconst local = 1;\nJSON.stringify(local);\n")
  engine := NewEngine(RuleConfig{"typescript/no-useless-empty-export": SeverityError})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("engine configuration: %v", err)
  }
  if engine.EnabledRules()["typescript/no-useless-empty-export"] != SeverityError {
    t.Fatalf("typescript/no-useless-empty-export is not enabled at error severity: %v", engine.EnabledRules())
  }
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected no findings, got %v", findingRules(findings))
  }
}
