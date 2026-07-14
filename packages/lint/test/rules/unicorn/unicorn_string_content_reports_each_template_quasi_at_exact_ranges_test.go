package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornStringContentReportsEachTemplateQuasiAtExactRanges verifies a
// substitution template reports one finding per matching quasi.
//
// Upstream targets `TemplateElement`, not the template literal, so
// `` `no${foo}no${foo}no` `` yields three findings whose ranges include the
// quasi delimiters (backtick / `${` / `}`), and each fix edit must stay
// inside its own quasi payload without touching the substitutions.
//
//  1. Lint the three-quasi template under `{no: "yes"}`.
//  2. Assert three findings at the head/middle/tail delimiter-inclusive
//     ranges, each with a one-edit fix confined to the raw payload.
//  3. Apply the fixes, compare with the upstream output, and assert the
//     fixed source no longer fires.
func TestUnicornStringContentReportsEachTemplateQuasiAtExactRanges(t *testing.T) {
  source := "declare const foo: string;\nconst bar = `no${foo}no${foo}no`;\n"
  options := `{"patterns":{"no":"yes"}}`

  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(options))
  if len(findings) != 3 {
    t.Fatalf("want three findings (one per quasi), got %d (%+v)", len(findings), findings)
  }
  template := strings.Index(source, "`no")
  wantRanges := [][2]int{
    {template, template + len("`no${")},
    {template + len("`no${foo"), template + len("`no${foo}no${")},
    {template + len("`no${foo}no${foo"), template + len("`no${foo}no${foo}no`")},
  }
  for index, finding := range findings {
    if finding.Pos != wantRanges[index][0] || finding.End != wantRanges[index][1] {
      t.Fatalf("finding %d range: want [%d,%d), got [%d,%d)", index, wantRanges[index][0], wantRanges[index][1], finding.Pos, finding.End)
    }
    if len(finding.Fix) != 1 || finding.Fix[0].Text != "yes" {
      t.Fatalf("finding %d fix: want one quasi edit to \"yes\", got %+v", index, finding.Fix)
    }
    if source[finding.Fix[0].Pos:finding.Fix[0].End] != "no" {
      t.Fatalf("finding %d fix must replace exactly the raw payload, got [%d,%d)=%q", index, finding.Fix[0].Pos, finding.Fix[0].End, source[finding.Fix[0].Pos:finding.Fix[0].End])
    }
  }

  expected := "declare const foo: string;\nconst bar = `yes${foo}yes${foo}yes`;\n"
  assertFixSnapshotWithOptions(t, "unicorn/string-content", source, options, expected)
  assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", expected, options)
}
