package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoVarSkipsDeclarationFileVars verifies ambient declaration variables do
// not trip the runtime noVar rule.
//
// TypeScript declaration files use `var` to describe globals and namespace
// exports. ESLint's noVar does not report those ambient declarations, so the
// native rule must preserve that behavior now that lint walks user-authored
// `.d.ts` roots from tsconfig.
//
// 1. Parse a declaration-like source containing `var`.
// 2. Mark the source file as a declaration file.
// 3. Run noVar and assert no finding is emitted.
func TestNoVarSkipsDeclarationFileVars(t *testing.T) {
  file := parseTS(t, "declare var value: string;\n")
  file.IsDeclarationFile = true
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported ambient declaration vars: %d findings", len(findings))
  }
}
