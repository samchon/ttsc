package linthost

import "testing"

// TestFilterFormatFindingsKeepsOnlyFormatRuleFindings verifies the
// format-side filter.
//
// `ttsc format` and LSP format requests call
// `filterFormatFindings` to narrow the engine's mixed finding stream to the
// format-rule subset with attached edits, so formatting never applies
// lint-class edits and never drops a fixable format finding silently. The lint-side
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
//
// @evidence contracts/testing.md#behavioral-verification filterFormatFindings admits format/semi and format/quotes only when fixes are attached, rejecting lint entries, nil and format-without-fix. Original-pointer membership also rejects a duplicated survivor while permitting either output order.
// @evidence contracts/testing.md#independent-expectations The hand-authored mixed slice determines exactly two admissible original findings under the write-only format contract, independently of the filtering implementation.
// @evidence contracts/testing.md#distinguishing-cases A six-entry slice separates the four decision outcomes: a lint finding with a fix, a nil entry, a lint finding without a fix and a format finding without edits are dropped, while the two format findings with edits (format/semi, format/quotes) are kept as the original pointers.
// @evidence contracts/testing.md#execution-ownership TestFilterFormatFindingsKeepsOnlyFormatRuleFindings owns its fixture cases as an in-process Go test selected by the root test:go package population. It calls filterFormatFindings directly rather than launching a separately built product host or executing an LSP action.
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
  if !((bucket[0] == findings[1] && bucket[1] == findings[3]) ||
    (bucket[0] == findings[3] && bucket[1] == findings[1])) {
    t.Fatalf("filter changed or duplicated admitted findings: %+v", bucket)
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
