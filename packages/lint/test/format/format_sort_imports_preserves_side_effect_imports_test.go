package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsPreservesSideEffectImports verifies the rule
// declines to sort a block that contains a side-effect-only import.
//
// `import "./polyfill"` runs the polyfill's top-level code for its
// observable effect (e.g. installing globals). A later value import may
// depend on that effect having already run, so sorting it lexically
// next to other specifiers can silently change runtime behavior. The
// rule's safety policy matches the comment-trivia bail: refuse to
// reorder the block when correctness can't be locally proven.
//
//  1. Parse a source with mixed side-effect and value imports in an
//     order the lexical sort would change.
//  2. Run formatSortImports.
//  3. Assert zero findings — the block stays in source order.
func TestFormatSortImportsPreservesSideEffectImports(t *testing.T) {
  source := "import \"./polyfill\";\n" +
    "import { reduce } from \"./local-a\";\n" +
    "import \"./shim\";\n" +
    "import alpha from \"alpha\";\n" +
    "JSON.stringify({ reduce, alpha });\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"formatSortImports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings (side-effect imports inhibit sort), got %d:\n%v",
      len(findings), findings)
  }
}
