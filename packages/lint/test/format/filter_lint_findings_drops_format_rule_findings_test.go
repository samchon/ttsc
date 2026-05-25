package linthost

import "testing"

// TestFilterLintFindingsDropsFormatRuleFindings verifies the lint-side filter.
//
// LSP fix-all uses `filterLintFindings` so document-format edits do not ride
// along with `ttsc.lint.fixAll`. The inverse of the format filter matters now
// that editor code actions expose lint fixes and formatting as separate source
// actions.
//
// 1. Build a mixed finding slice with lint and format entries.
// 2. Run `filterLintFindings`.
// 3. Assert only non-format findings survive.
func TestFilterLintFindingsDropsFormatRuleFindings(t *testing.T) {
  findings := []*Finding{
    {Rule: "no-var", IsFormat: false},
    {Rule: "format/semi", IsFormat: true},
    nil,
    {Rule: "eqeqeq", IsFormat: false},
  }
  bucket := filterLintFindings(findings)
  if len(bucket) != 2 {
    t.Fatalf("lint bucket: want 2 findings, got %d", len(bucket))
  }
  for _, finding := range bucket {
    if finding == nil {
      t.Fatal("filter leaked a nil finding")
    }
    if finding.IsFormat {
      t.Fatalf("filter leaked a format finding: %+v", finding)
    }
  }
}
