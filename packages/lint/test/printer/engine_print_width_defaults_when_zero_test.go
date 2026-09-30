package linthost

import (
  "strings"
  "testing"
)

// Verifies omitted and negative print widths select exactly eighty columns.
//
// A merely generous fallback would pass a short flat group. The boundary
// pair proves the documented width itself: eighty columns fit and the
// adjacent eighty-one-column projection must break without losing text.
//
// 1. Print the original short group with zero and negative widths.
// 2. Keep an exactly eighty-column group flat under both options.
// 3. Require the adjacent eighty-one-column group to break.
//
// @evidence contracts/testing.md#behavioral-verification Print must use exactly the eighty-column budget for zero or negative PrintWidth, retaining a short flat group and distinguishing widths eighty and eighty-one.
// @evidence contracts/testing.md#independent-expectations Literal lengths seventy-eight or seventy-nine plus one space and b independently establish eighty versus eighty-one columns under the documented default.
// @evidence contracts/testing.md#distinguishing-cases Both zero and negative widths retain foo bar, keep the exact eighty-column projection flat and break the adjacent eighty-one-column projection.
// @evidence contracts/testing.md#execution-ownership TestEnginePrintWidthDefaultsWhenZero is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEnginePrintWidthDefaultsWhenZero(t *testing.T) {
  for _, omitted := range []int{0, -1} {
    opts := PrintOptions{PrintWidth: omitted, TabWidth: 2, EndOfLine: "lf"}
    doc := Group(Text("foo"), Line(), Text("bar"))
    if got := Print(doc, opts); got != "foo bar" {
      t.Fatalf("PrintWidth=%d should default to 80 (flat), got %q", omitted, got)
    }
    fitsDefault := strings.Repeat("a", 78)
    if got := Print(Group(Text(fitsDefault), Line(), Text("b")), opts); got != fitsDefault+" b" {
      t.Fatalf("exactly 80 columns must fit the default budget, got %q", got)
    }
    exceedsDefault := strings.Repeat("a", 79)
    if got := Print(Group(Text(exceedsDefault), Line(), Text("b")), opts); got != exceedsDefault+"\nb" {
      t.Fatalf("81 columns must break at the default budget, got %q", got)
    }
  }
}
