package linthost

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

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
//  1. Parse a source file with a comment between a `var` and its
//     declaration list.
//  2. Call NodeText on the VariableStatement.
//  3. Assert the returned text starts with `var` (trivia stripped).
//
// @evidence contracts/testing.md#behavioral-verification Actual NodeText returns exactly var x = 1; from a statement preceded by a newline and block comment, and returns empty text for missing file or node.
// @evidence contracts/testing.md#independent-expectations Literal complete statement text is authored independently of extraction, so preserving only a var prefix cannot pass and neither leading trivia nor extra source is accepted.
// @evidence contracts/testing.md#distinguishing-cases Leading newline plus comment distinguish token text from raw node ranges; missing file and missing node supply defensive controls alongside a real parsed statement.
// @evidence contracts/testing.md#execution-ownership The public AST utility processes an actual parsed virtual statement in the shared Go process; no native producer, CLI, fixture installation or repository-file inspection runs.
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
  if got != "var x = 1;" {
    t.Fatalf("NodeText should strip leading trivia, got %q", got)
  }
  if astutil.NodeText(nil, stmt) != "" || astutil.NodeText(file, nil) != "" { t.Fatal("absent file/node should not yield source text") }
}
