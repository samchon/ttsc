package linthost

import "testing"

// TestFilterFormatFindingsKeepsOnlyFormatRuleFindings verifies the
// format-side filter.
//
// `RunFormat` is the only caller of `filterFormatFindings`: it
// short-circuits the engine's mixed finding stream to the format-rule
// subset with attached edits so `ttsc format` never applies lint-class
// edits AND never drops a fixable format finding silently. The lint-side
// inverse filter is tested separately because LSP fix-all and format actions
// now expose those edit classes independently.
//
//  1. Build a mixed finding slice covering format-with-fix,
//     format-without-fix, lint-with-fix, lint-without-fix, plus a nil
//     sentinel.
//  2. Run `filterFormatFindings`.
//  3. Assert only format-tagged findings that also carry at least one
//     fix survive; nils and lint findings are dropped, and a format
//     finding with no fix is also dropped (format mode is write-only).
func TestFilterFormatFindingsKeepsOnlyFormatRuleFindings(t *testing.T) {
  withFix := []TextEdit{{Pos: 0, End: 1, Text: ""}}
  findings := []*Finding{
    {Rule: "no-var", IsFormat: false, Fix: withFix},
    {Rule: "format/semi", IsFormat: true, Fix: withFix},
    nil,
    {Rule: "format/quotes", IsFormat: true, Fix: withFix},
    {Rule: "eqeqeq", IsFormat: false},
    {Rule: "format/no-fix-rule", IsFormat: true}, // format but no edits
  }
  bucket := filterFormatFindings(findings)
  if len(bucket) != 2 {
    t.Fatalf("format bucket: want 2 findings, got %d", len(bucket))
  }
  for _, f := range bucket {
    if f == nil {
      t.Fatalf("filter leaked a nil finding")
    }
    if !f.IsFormat {
      t.Fatalf("filter leaked a lint finding: %+v", f)
    }
    if len(f.Fix) == 0 {
      t.Fatalf("filter leaked a no-fix finding: %+v", f)
    }
  }
}
