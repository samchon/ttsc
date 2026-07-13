package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentSuggestionRewritesManySlashLineComment verifies directive
// matching and the opt-in edit on a line comment with extra leading slashes.
//
// The compiler's error-suppression regex accepts any number of slashes
// before `@ts-ignore` (unlike the 2-3 slash pragma rule), and upstream's
// suggestion output for `/////@ts-ignore: Suppress next line` swaps only
// the directive token. Both the match and the surgical edit are pinned.
//
// 1. Lint `/////@ts-ignore` above a genuinely erroneous line.
// 2. Assert the replacement is suggestion-only.
// 3. Apply it and preserve every surrounding byte.
func TestBanTsCommentSuggestionRewritesManySlashLineComment(t *testing.T) {
  source := "/////@ts-ignore: Suppress next line\nconst a: number = \"wrong\";\nJSON.stringify(a);\n"
  expected := "/////@ts-expect-error: Suppress next line\nconst a: number = \"wrong\";\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"typescript/ban-ts-comment": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1", len(findings))
  }
  finding := findings[0]
  if len(finding.Fix) != 0 || len(finding.Suggestions) != 1 {
    t.Fatalf("fixes = %d, suggestions = %d", len(finding.Fix), len(finding.Suggestions))
  }
  rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: finding.Suggestions[0].Edits}})
  if applied != 1 || rewritten != expected {
    t.Fatalf("applied = %d\nwant %q\ngot  %q", applied, expected, rewritten)
  }
}
