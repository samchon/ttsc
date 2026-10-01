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
//
// @evidence contracts/testing.md#behavioral-verification A reversed b,a named list with an interior pin comment must emit zero findings, preserving its attachment and both uses.
// @evidence contracts/testing.md#independent-expectations The literal user comment cannot disappear when specifier text is reconstructed. Zero findings independently enforces the supported comment-protection policy; the uncommented alphabetization host fixes the same ordering class.
// @evidence contracts/testing.md#distinguishing-cases One declaration excludes runtime-block sorting as a confounder. The comment sits between two specifiers, unlike the final-specifier merge-protection and between-import comment hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsPreservesCommentsBetweenSpecifiers owns its literal commented list and direct engine zero-finding assertion in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
