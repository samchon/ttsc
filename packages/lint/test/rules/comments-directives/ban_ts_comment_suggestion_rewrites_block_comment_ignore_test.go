package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentSuggestionRewritesBlockCommentIgnore verifies the opt-in
// ignore-to-expect-error suggestion inside a CRLF block comment.
//
// Upstream's suggestion rebuilds `/*` + rewritten value + `*/`; the edit
// here must be equivalent — replace only the directive token and keep the
// block delimiters and spacing byte-identical.
//
//  1. Lint a block comment whose last line contains the directive and description.
//  2. Assert the finding has no automatic fix and one suggestion.
//  3. Apply that suggestion and preserve delimiters, description, CRLF, and code.
func TestBanTsCommentSuggestionRewritesBlockCommentIgnore(t *testing.T) {
  source := "/* header\r\n * @ts-ignore: Preserve this description */\r\nconst a: number = 1;\r\nJSON.stringify(a);\r\n"
  expected := "/* header\r\n * @ts-expect-error: Preserve this description */\r\nconst a: number = 1;\r\nJSON.stringify(a);\r\n"
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
