package main

import (
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// TestAstutilNodeTextStripsLeadingTrivia verifies astutil.NodeText.
//
// Contributors emitting fixes often need to splice a sub-node's text
// into a replacement string; the convenience contract is that the
// returned text starts at the token, not at the start of leading
// trivia. A regression in the SkipTrivia call would silently include
// preceding comments / whitespace and corrupt every fix that uses it.
//
// 1. Parse a source file with a comment between a `var` and its
//    declaration list.
// 2. Call NodeText on the VariableStatement.
// 3. Assert the returned text starts with `var` (trivia stripped).
func TestAstutilNodeTextStripsLeadingTrivia(t *testing.T) {
  source := "\n/* hi */ var x = 1;\n"
  file := shimparser.ParseSourceFile(
    ast.SourceFileParseOptions{FileName: "/virtual/astutil-node-text.ts"},
    source,
    shimcore.ScriptKindTS,
  )
  if file == nil || file.Statements == nil || len(file.Statements.Nodes) == 0 {
    t.Fatal("parser returned no statements")
  }
  stmt := file.Statements.Nodes[0]
  got := astutil.NodeText(file, stmt)
  if got == "" || got[:3] != "var" {
    t.Fatalf("NodeText should strip leading trivia, got %q", got)
  }
}
