package linthost

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// TestAstutilFindKeywordIsIdentifierAware verifies astutil.FindKeyword.
//
// FindKeyword scans an arbitrary byte range for a keyword token, refusing
// matches inside identifiers. Matching raw substrings instead of tokens
// would let searches for `import` match the prefix of `importMap` and
// route fixes to the wrong byte offset.
//
//  1. Parse a source containing both `import` (keyword) and `importMap`
//     (identifier sharing the prefix).
//  2. Call FindKeyword over the entire file looking for "import".
//  3. Assert complete token bounds and repeat with literal, trivia and UTF-8
//     prefixes, requiring only the independently positioned real import.
//
// @evidence contracts/testing.md#behavioral-verification Actual FindKeyword skips importMap and returns the real import token at literal byte 22; identifier-only and truncated-token ranges, opaque literal/comment prefixes, nil source and empty keyword produce no match. Authored UTF-8 text requires byte rather than rune offsets.
// @evidence contracts/testing.md#independent-expectations The authored source has a manually counted 22-byte prefix; literal 22 and -1 outcomes establish complete-token selection independently of scanner output. Additional cases place the real import immediately after an authored prefix whose Go byte length independently determines its offset, without using the product parser or scanner to calculate the expected position.
// @evidence contracts/testing.md#distinguishing-cases A same-prefix identifier contrasts with the real keyword; excluding its byte range or the final keyword byte tests complete bounds, with absent inputs checked separately. String, regexp, template and JSX text containing import contrast with a real import outside them; comment and Unicode prefixes retain lexical context and byte coordinates.
// @evidence contracts/testing.md#execution-ownership Public astutil search reads a real parsed virtual TypeScript source directly in-process; no native build, CLI, repository text search or installed host participates.
func TestAstutilFindKeywordIsIdentifierAware(t *testing.T) {
  source := "const importMap = {};\nimport \"x\";\n"
  file := shimparser.ParseSourceFile(
    ast.SourceFileParseOptions{FileName: "/virtual/astutil-find-keyword.ts"},
    source,
    shimcore.ScriptKindTS,
  )
  if file == nil {
    t.Fatal("parser returned nil source file")
  }
  pos := astutil.FindKeyword(file, 0, len(source), "import")
  // The keyword is on the second line; `const importMap` is on the first.
  // A bug ignoring identifier flanks would return offset 6 (start of
  // `importMap`'s `i`). The correct hit is the keyword start, well past
  // the identifier.
  if pos < 0 {
    t.Fatal("FindKeyword should have located the keyword token")
  }
  // The keyword `import` on line 2 starts at offset 22 (`const importMap = {};\n` = 22 bytes).
  if pos != 22 {
    t.Fatalf("FindKeyword should skip the identifier prefix; got offset %d, source slice %q",
      pos, source[pos:pos+6])
  }
  if astutil.FindKeyword(file, 0, 22, "import") != -1 || astutil.FindKeyword(file, 22, 27, "import") != -1 { t.Fatal("identifier prefix or incomplete keyword range was accepted") }
  if astutil.FindKeyword(nil, 0, len(source), "import") != -1 || astutil.FindKeyword(file, 0, len(source), "") != -1 { t.Fatal("absent file/keyword should return no match") }
  cases := []struct {
    name   string
    prefix string
    kind   shimcore.ScriptKind
  }{
    {"string", "const value = \"import\";\n", shimcore.ScriptKindTS},
    {"regexp", "const pattern = /import/;\n", shimcore.ScriptKindTS},
    {"template", "const value = `import`;\n", shimcore.ScriptKindTS},
    {"comment", "/* import */\n", shimcore.ScriptKindTS},
    {"jsx", "const view = <div>import</div>;\n", shimcore.ScriptKindTSX},
    {"unicode", "const café = \"한글\";\n", shimcore.ScriptKindTS},
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      text := entry.prefix + "import \"x\";\n"
      parsed := shimparser.ParseSourceFile(
        ast.SourceFileParseOptions{FileName: "/virtual/keyword.tsx"}, text, entry.kind,
      )
      if parsed == nil {
        t.Fatal("parser returned nil source")
      }
      expected := len(entry.prefix)
      if got := astutil.FindKeyword(parsed, 0, len(text), "import"); got != expected {
        t.Fatalf("real import byte offset: want %d, got %d", expected, got)
      }
      if got := astutil.FindKeyword(parsed, 0, expected, "import"); got != -1 {
        t.Fatalf("prefix supplied a false import keyword at %d", got)
      }
    })
  }
}
