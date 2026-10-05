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
//  1. Parse a var declaration and check its declaration-list keyword.
//  2. Contrast missing keywords, names and absent inputs.
//  3. Check long-trivia, decorated and Unicode declaration prefixes while
//     rejecting keywords present only in literals or a function body.
//
// @evidence contracts/testing.md#behavioral-verification Actual KeywordStart locates var at byte zero on a parsed declaration list, rejects absent const and identifier x, and rejects missing source, node or keyword. Additional declarations retain exact byte positions after trivia/modifiers/decorators and exclude keyword text from decorator literals or bodies.
// @evidence contracts/testing.md#independent-expectations The authored var declaration independently defines byte zero; literal -1 for a different declaration keyword or declaration name is established by the public token-search contract. Additional expected offsets are the byte lengths of authored prefixes before the declared keyword, independently of parser/scanner results.
// @evidence contracts/testing.md#distinguishing-cases A matching declaration keyword contrasts with an absent keyword and a name that is not a keyword; nil source/node and empty keyword exercise independent absent-input gates. Long comments contrast with bounded raw-prefix guesses; a decorated class includes class text inside its argument and a function includes return only inside its body. Unicode prefix text distinguishes byte from rune coordinates.
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
  if astutil.KeywordStart(file, declList, "const") != -1 || astutil.KeywordStart(file, declList, "x") != -1 {
    t.Fatal("missing keyword or declaration name was accepted as declaration keyword")
  }
  if astutil.KeywordStart(nil, declList, "var") != -1 || astutil.KeywordStart(file, nil, "var") != -1 || astutil.KeywordStart(file, declList, "") != -1 {
    t.Fatal("absent keyword input should return no match")
  }
  cases := []struct {
    name      string
    prefix    string
    tail      string
    keyword   string
    forbidden string
  }{
    {"long trivia", "/* a deliberately long declaration prefix beyond thirty-two bytes */\nexport ", "function target() { return 1; }\n", "function", "return"},
    {"decorator", "@decorate(\"class\")\nexport ", "class Target {}\n", "class", "function"},
    {"unicode decorator", "@decorate(\"한글\")\nexport ", "class Target {}\n", "class", "return"},
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      text := entry.prefix + entry.tail
      parsed := shimparser.ParseSourceFile(
        ast.SourceFileParseOptions{FileName: "/virtual/declaration.ts"}, text, shimcore.ScriptKindTS,
      )
      if parsed == nil || parsed.Statements == nil || len(parsed.Statements.Nodes) != 1 {
        t.Fatal("parser returned no unique declaration")
      }
      declaration := parsed.Statements.Nodes[0]
      if got := astutil.KeywordStart(parsed, declaration, entry.keyword); got != len(entry.prefix) {
        t.Fatalf("declaration keyword byte offset: want %d, got %d", len(entry.prefix), got)
      }
      if got := astutil.KeywordStart(parsed, declaration, entry.forbidden); got != -1 {
        t.Fatalf("non-header keyword was accepted at %d", got)
      }
    })
  }
}
