package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsPreservesCommentsBetweenImports verifies the rule
// bails the block-level reorder when comments separate imports.
//
// User comments often anchor specific imports ("`// MUST be first`",
// dependency-injection hints, etc.). Moving comments with the wrong
// declaration is strictly worse than leaving the order alone. The rule's
// `leadingTriviaIsAllWhitespace` guard is the load-bearing predicate;
// this scenario pins it.
//
//  1. Parse a source file with a comment between two imports.
//  2. Run the engine with formatSortImports enabled.
//  3. Assert no block-level reorder finding fires (specifier-level findings
//     may still fire for the same file, but the block reorder must not).
func TestFormatSortImportsPreservesCommentsBetweenImports(t *testing.T) {
  source := "import zebra from \"zebra\";\n" +
    "// pinned by dependency injection wiring\n" +
    "import alpha from \"alpha\";\n" +
    "JSON.stringify({ zebra, alpha });\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/sort-imports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  for _, finding := range findings {
    if finding.Message == "Imports must be sorted into canonical groups." {
      t.Fatalf("block reorder fired despite intervening comment: %+v", finding)
    }
  }
}
