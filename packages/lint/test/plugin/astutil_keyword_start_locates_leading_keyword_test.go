package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Actual KeywordStart locates var at byte zero on a parsed declaration list, rejects absent const and identifier x, and rejects missing source, node or keyword.
// @evidence contracts/testing.md#independent-expectations The authored var declaration independently defines byte zero; literal -1 for a different declaration keyword or declaration name is established by the public token-search contract.
// @evidence contracts/testing.md#distinguishing-cases A matching declaration keyword contrasts with an absent keyword and a name that is not a keyword; nil source/node and empty keyword exercise independent absent-input gates.
// @evidence contracts/testing.md#execution-ownership Real parser ASTs and public astutil.KeywordStart execute directly in-process without contributor artifacts, installation, child hosts or source-layout assertions.
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
  if astutil.KeywordStart(file, declList, "const") != -1 || astutil.KeywordStart(file, declList, "x") != -1 { t.Fatal("missing keyword or declaration name was accepted as declaration keyword") }
  if astutil.KeywordStart(nil, declList, "var") != -1 || astutil.KeywordStart(file, nil, "var") != -1 || astutil.KeywordStart(file, declList, "") != -1 { t.Fatal("absent keyword input should return no match") }
}
