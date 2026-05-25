package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsPreservesCommentsBetweenSpecifiers verifies the
// specifier-sort path declines to reorder a `{ b /*pin*/, a }` list.
//
// The rule rejoins sorted specifiers with `", "` — any `/* x */` or
// `// x` between specifiers would be silently discarded. The
// block-level sort already bails on comment trivia between
// declarations (via `leadingTriviaIsAllWhitespace`); this scenario
// pins the per-specifier analog so the cohort policy is consistent.
//
//  1. Parse an import whose named-specifier list carries an inline
//     block comment between two specifiers.
//  2. Run formatSortImports.
//  3. Assert zero findings — the rule must NOT propose an edit that
//     would silently drop the comment.
func TestFormatSortImportsPreservesCommentsBetweenSpecifiers(t *testing.T) {
  source := "import { b /* pin */, a } from \"./local\";\n" +
    "console.log(a, b);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/sort-imports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings (specifier-sort must not drop inline comments), got %d:\n%v",
      len(findings), findings)
  }
}
