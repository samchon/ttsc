package main

import "testing"

// TestFilterFormatFindingsKeepsOnlyFormatRuleFindings verifies the
// format-side filter.
//
// `RunFormat` is the only caller of `filterFormatFindings`: it
// short-circuits the engine's mixed finding stream to the format-rule
// subset so `ttsc format` never applies lint-class edits. `RunFix` does
// not filter — fix is the run-everything entry point — so the inverse
// filter is intentionally absent. Testing the format filter alone with
// a mixed synthetic input pins the routing contract.
//
// 1. Build a mixed finding slice with format and lint entries plus a
//    nil sentinel.
// 2. Run `filterFormatFindings`.
// 3. Assert only format-tagged findings survive and nils are dropped.
func TestFilterFormatFindingsKeepsOnlyFormatRuleFindings(t *testing.T) {
  findings := []*Finding{
    {Rule: "no-var", IsFormat: false},
    {Rule: "format/semi", IsFormat: true},
    nil,
    {Rule: "format/quotes", IsFormat: true},
    {Rule: "eqeqeq", IsFormat: false},
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
  }
}
