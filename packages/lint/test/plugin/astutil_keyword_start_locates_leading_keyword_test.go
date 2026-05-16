package main

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// TestAstutilKeywordStartLocatesLeadingKeyword verifies astutil.KeywordStart.
//
// Contributor fixers that swap a declaration keyword (`var → let`, the
// `no-var` pattern) anchor their TextEdit via KeywordStart. A regression
// that returned -1 or the wrong offset would break every such fixer.
//
// 1. Parse a `var x = 1;` source.
// 2. Call KeywordStart with the VariableStatement node and the keyword "var".
// 3. Assert the returned offset points at the actual `v` byte.
func TestAstutilKeywordStartLocatesLeadingKeyword(t *testing.T) {
  source := "var x = 1;\n"
  file := shimparser.ParseSourceFile(
    ast.SourceFileParseOptions{FileName: "/virtual/astutil-keyword-start.ts"},
    source,
    shimcore.ScriptKindTS,
  )
  if file == nil || file.Statements == nil || len(file.Statements.Nodes) == 0 {
    t.Fatal("parser returned no statements")
  }
  stmt := file.Statements.Nodes[0]
  declList := stmt.AsVariableStatement().DeclarationList
  pos := astutil.KeywordStart(file, declList, "var")
  if pos != 0 {
    t.Fatalf("KeywordStart should locate `var` at offset 0, got %d", pos)
  }
}
