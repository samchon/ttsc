package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Actual TokenRange returns literal half-open 22..34 around const x = 1;, retaining the complete statement while excluding its preceding comment; missing file or node returns -1,-1.
// @evidence contracts/testing.md#independent-expectations Authored comment and statement byte lengths independently determine 22 and 34; exact source slice and sentinel pair verify both coordinates instead of deriving expected bounds from the AST.
// @evidence contracts/testing.md#distinguishing-cases Comment-leading statement contrasts with absent file/node; exact end and complete slice distinguish start-only correctness from truncating or consuming trailing source.
// @evidence contracts/testing.md#execution-ownership Public astutil.TokenRange runs on a real parsed statement directly in-process, with no contributor build, installed consumer, kernel boundary or file-existence assertions.
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
  if end != 34 || source[pos:end] != "const x = 1;" {
    t.Fatalf("TokenRange should retain complete half-open statement bounds, got %d..%d", pos, end)
  }
  if p, e := astutil.TokenRange(nil, stmt); p != -1 || e != -1 {
    t.Fatalf("absent file should return sentinel pair: %d..%d", p, e)
  }
  if p, e := astutil.TokenRange(file, nil); p != -1 || e != -1 {
    t.Fatalf("absent node should return sentinel pair: %d..%d", p, e)
  }
}
