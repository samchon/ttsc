package linthost

import (
  "slices"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// TestCommentScanUsesParserLexicalRangesAcrossSourceModes verifies exact,
// deduplicated comment ranges under every TypeScript and JavaScript source mode.
//
// Regex, template, string, and JSX-text bodies are parser-owned tokens rather
// than trivia. Real comments at file edges, in empty containers, in template
// substitutions, and after division must remain visible across CRLF and Unicode
// line terminators, while comment-shaped literal bytes remain invisible.
//
//  1. Parse equivalent TS/JS sources with nested templates, regexes, and division.
//  2. Parse equivalent TSX/JSX sources with JSX text and expression comments.
//  3. Assert every real comment's kind and exact range once, in source order.
func TestCommentScanUsesParserLexicalRangesAcrossSourceModes(t *testing.T) {
  scriptSource := "/* file-leading-real */\r\n" +
    "const quoted = \"// fake-string\"; // trailing-real\r\n" +
    "const divided = `${8 / 2 /* division-real */}`;\u2028" +
    "const matched = `${/[{]/.test(\"{\") /* regex-real */}`;\u2029" +
    "const nested = `/* fake-template */ ${`${1 /* nested-real */}`}`;\n" +
    "const empty = { /* empty-object-real */ };\n" +
    "function noop() { /* empty-block-real */ }\n" +
    "/* file-trailing-real */"
  scriptComments := []string{
    "/* file-leading-real */",
    "// trailing-real",
    "/* division-real */",
    "/* regex-real */",
    "/* nested-real */",
    "/* empty-object-real */",
    "/* empty-block-real */",
    "/* file-trailing-real */",
  }
  jsxSource := "/* jsx-leading-real */\n" +
    "const view = <div>// fake-jsx-line\n/* fake-jsx-block */" +
    "{/* jsx-expression-real */}<span title=\"// fake-attribute\">text</span></div>;\n" +
    "// jsx-trailing-real"
  jsxComments := []string{
    "/* jsx-leading-real */",
    "/* jsx-expression-real */",
    "// jsx-trailing-real",
  }

  cases := []struct {
    name       string
    fileName   string
    kind       shimcore.ScriptKind
    source     string
    comments   []string
  }{
    {name: "ts", fileName: "/virtual/comments.ts", kind: shimcore.ScriptKindTS, source: scriptSource, comments: scriptComments},
    {name: "js", fileName: "/virtual/comments.js", kind: shimcore.ScriptKindJS, source: scriptSource, comments: scriptComments},
    {name: "tsx", fileName: "/virtual/comments.tsx", kind: shimcore.ScriptKindTSX, source: jsxSource, comments: jsxComments},
    {name: "jsx", fileName: "/virtual/comments.jsx", kind: shimcore.ScriptKindJSX, source: jsxSource, comments: jsxComments},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      file := shimparser.ParseSourceFile(shimast.SourceFileParseOptions{FileName: test.fileName}, test.source, test.kind)
      if file == nil {
        t.Fatal("parser returned nil source file")
      }
      assertExactCommentTokens(t, file, test.source, test.comments)
    })
  }
}

func assertExactCommentTokens(t *testing.T, file *shimast.SourceFile, source string, expectedText []string) {
  t.Helper()
  expected := make([]commentToken, 0, len(expectedText))
  for _, text := range expectedText {
    pos := strings.Index(source, text)
    if pos < 0 {
      t.Fatalf("expected comment %q is absent from fixture", text)
    }
    kind := shimast.KindMultiLineCommentTrivia
    if strings.HasPrefix(text, "//") {
      kind = shimast.KindSingleLineCommentTrivia
    }
    expected = append(expected, commentToken{kind: kind, pos: pos, end: pos + len(text)})
  }
  sort.Slice(expected, func(i, j int) bool { return expected[i].pos < expected[j].pos })

  actual := make([]commentToken, 0)
  forEachCommentToken(file, func(kind shimast.Kind, pos, end int) {
    actual = append(actual, commentToken{kind: kind, pos: pos, end: end})
  })
  if !slices.Equal(actual, expected) {
    actualText := make([]string, 0, len(actual))
    for _, token := range actual {
      actualText = append(actualText, source[token.pos:token.end])
    }
    t.Fatalf("want tokens %+v, got %+v (%q)", expected, actual, actualText)
  }
}
