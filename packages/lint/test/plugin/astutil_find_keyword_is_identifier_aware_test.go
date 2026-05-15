package main

import (
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// TestAstutilFindKeywordIsIdentifierAware verifies astutil.FindKeyword.
//
// FindKeyword scans an arbitrary byte range for a keyword token, refusing
// matches inside identifiers. A regression that dropped the flank guard
// would let searches for `import` match the prefix of `importMap` and
// route fixes to the wrong byte offset.
//
// 1. Parse a source containing both `import` (keyword) and `importMap`
//    (identifier sharing the prefix).
// 2. Call FindKeyword over the entire file looking for "import".
// 3. Assert the returned offset is the keyword's position, not the
//    identifier prefix.
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
}
