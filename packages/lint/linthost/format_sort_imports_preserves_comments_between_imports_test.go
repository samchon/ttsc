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
//  4. Exercise the unsafe boundary and its adjacent positive.
//
// @evidence contracts/testing.md#behavioral-verification The original engine result must not contain a block-reorder finding; unsafe sorting must still preserve the intervening dependency-wiring comment without findings.
// @evidence contracts/testing.md#independent-expectations The explicit comment is attached between zebra and alpha declarations. Literal comment-free output is alpha then zebra under the supported unsafe lexical-order policy.
// @evidence contracts/testing.md#distinguishing-cases The original default runtime barrier remains covered. An unsafe negative isolates comment protection, and the same declarations without that comment supply its adjacent reorder positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsPreservesCommentsBetweenImports owns the original engine diagnostic check plus authored unsafe negative and comment-free full-output positive in the selected public Go unit population. Parsing, the owning rule and fixture edit observation execute in one Go process without native builds, consumer installation or product-host children.
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
  assertRuleSkipsSourceWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`)
  assertFixSnapshotWithOptions(t, "format/sort-imports", "import zebra from \"zebra\";\nimport alpha from \"alpha\";\nJSON.stringify({ zebra, alpha });\n", `{"unsafeSortRuntimeImports":true}`, "import alpha from \"alpha\";\nimport zebra from \"zebra\";\nJSON.stringify({ zebra, alpha });\n")
}
