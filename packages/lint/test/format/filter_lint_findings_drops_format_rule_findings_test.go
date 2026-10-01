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
// @evidence contracts/testing.md#behavioral-verification filterLintFindings admits the original no-var and eqeqeq findings and rejects the format entry and nil sentinel. Original-pointer membership also rejects a duplicated survivor while permitting either output order.
// @evidence contracts/testing.md#independent-expectations The authored IsFormat flags determine the two admissible original findings independently of filter traversal.
// @evidence contracts/testing.md#distinguishing-cases A four-entry slice with two lint findings, one format finding and a nil entry: only the two non-format findings (original pointers) survive. Fix presence is not varied in this test.
// @evidence contracts/testing.md#execution-ownership TestFilterLintFindingsDropsFormatRuleFindings owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
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
  if !((bucket[0] == findings[0] && bucket[1] == findings[3]) ||
    (bucket[0] == findings[3] && bucket[1] == findings[0])) {
    t.Fatalf("filter changed or duplicated admitted findings: %+v", bucket)
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
