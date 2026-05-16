package main

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// TestAstutilTokenRangeStripsLeadingTrivia verifies astutil.TokenRange.
//
// TokenRange returns the [pos, end) range of a node with leading trivia
// (whitespace + comments) stripped from the start. Contributor fixers
// use it as the canonical "replace this whole node" range. A regression
// that returned node.Pos() (which includes trivia) would cause every
// such fix to consume the preceding whitespace or comment.
//
// 1. Parse a source with a comment immediately before a statement.
// 2. Call TokenRange on the statement.
// 3. Assert the returned pos starts at the statement's first token byte.
func TestAstutilTokenRangeStripsLeadingTrivia(t *testing.T) {
  source := "/* leading comment */ const x = 1;\n"
  file := shimparser.ParseSourceFile(
    ast.SourceFileParseOptions{FileName: "/virtual/astutil-token-range.ts"},
    source,
    shimcore.ScriptKindTS,
  )
  if file == nil || file.Statements == nil || len(file.Statements.Nodes) == 0 {
    t.Fatal("parser returned no statements")
  }
  stmt := file.Statements.Nodes[0]
  pos, end := astutil.TokenRange(file, stmt)
  // The token starts after the 22-byte block comment + space.
  if pos != 22 {
    t.Fatalf("TokenRange should skip leading comment; got pos=%d, slice=%q",
      pos, source[pos:end])
  }
  if source[pos:pos+5] != "const" {
    t.Fatalf("TokenRange should land on `const`; got slice %q", source[pos:pos+5])
  }
}
