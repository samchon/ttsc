package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineLintsSuppliedDeclarationFiles verifies the engine walks every
// file the host hands to it.
//
// Declaration-file ownership is a project-selection concern, not an engine
// concern. The command host filters to tsconfig roots before calling Run; once
// a `.d.ts` source reaches the engine, declaration-compatible rules must see it
// so declaration-heavy projects are linted and formatted on the same boundary
// as legacy tools.
//
// 1. Parse a source file containing a debugger statement.
// 2. Mark it as a declaration source file.
// 3. Run the no-debugger engine and assert the supplied file is linted.
func TestEngineLintsSuppliedDeclarationFiles(t *testing.T) {
  file := parseTS(t, "debugger;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("declaration file was not linted; got %d findings", len(findings))
  }
}
