package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineSkipsDeclarationFiles verifies that the engine produces zero findings for
// files whose IsDeclarationFile flag is set.
//
// Declaration files (`.d.ts`) are generated type stubs — linting them would produce
// spurious warnings on patterns that are idiomatic in type-only output (e.g. `var`
// declarations that represent CommonJS exports). The engine's per-file guard must check
// IsDeclarationFile before walking the AST; if the guard is absent, every `.d.ts`
// processed by the native sidecar emits noise.
//
// 1. Parse a source file containing a `var` statement.
// 2. Set IsDeclarationFile to true on the parsed SourceFile.
// 3. Run the no-var engine and assert zero findings.
func TestEngineSkipsDeclarationFiles(t *testing.T) {
  // Declaration files should not be linted (they're library typings).
  // The engine filters them by IsDeclarationFile.
  file := parseTS(t, "var a = 1;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Errorf("declaration files must be skipped; got %d findings", len(findings))
  }
}
