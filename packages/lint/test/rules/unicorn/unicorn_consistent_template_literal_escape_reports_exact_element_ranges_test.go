package linthost

import (
  "strings"
  "testing"
)

// TestUnicornConsistentTemplateLiteralEscapeReportsExactElementRanges
// verifies each finding highlights one template element token and carries
// one payload-only edit.
//
// Upstream reports the TemplateElement node, whose ESTree range equals
// the TS element token: opening backtick or `}` through the closing `${`
// or backtick. The autofix must rewrite only the raw payload between the
// delimiters, so an off-by-one on either side corrupts the template or
// its substitutions. Head, middle, tail, and no-substitution elements
// each pin their own delimiter widths.
//
//  1. Lint one template with head/middle/tail escapes plus one
//     no-substitution template.
//  2. Assert four findings with the upstream message at the exact token
//     ranges.
//  3. Assert each fix is a single edit spanning exactly the element
//     payload with the canonical replacement.
func TestUnicornConsistentTemplateLiteralEscapeReportsExactElementRanges(t *testing.T) {
  source := "const foo = `$\\{a}${expr}$\\{m}${expr}$\\{b}`;\nconst bar = `$\\{c}`;\n"
  expected := []struct {
    marker      string
    closerWidth int
    text        string
  }{
    {marker: "`$\\{a}${", closerWidth: 2, text: "\\${a}"},
    {marker: "}$\\{m}${", closerWidth: 2, text: "\\${m}"},
    {marker: "}$\\{b}`", closerWidth: 1, text: "\\${b}"},
    {marker: "`$\\{c}`", closerWidth: 1, text: "\\${c}"},
  }

  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, source, nil)
  if len(findings) != len(expected) {
    t.Fatalf("want %d findings, got %d (%+v)", len(expected), len(findings), findings)
  }
  for index, want := range expected {
    start := strings.Index(source, want.marker)
    if start < 0 {
      t.Fatalf("marker %q missing from source", want.marker)
    }
    end := start + len(want.marker)
    finding := findings[index]
    if finding.Message != "Use `\\${` instead of `$\\{` to escape in template literals." {
      t.Fatalf("finding %d message: got %q", index, finding.Message)
    }
    if finding.Pos != start || finding.End != end {
      t.Fatalf("finding %d range: want [%d,%d), got [%d,%d)", index, start, end, finding.Pos, finding.End)
    }
    if len(finding.Fix) != 1 {
      t.Fatalf("finding %d must carry exactly one edit, got %+v", index, finding.Fix)
    }
    edit := finding.Fix[0]
    if edit.Pos != start+1 || edit.End != end-want.closerWidth {
      t.Fatalf("finding %d edit range: want [%d,%d), got [%d,%d)", index, start+1, end-want.closerWidth, edit.Pos, edit.End)
    }
    if edit.Text != want.text {
      t.Fatalf("finding %d edit text: want %q, got %q", index, want.text, edit.Text)
    }
  }
}
