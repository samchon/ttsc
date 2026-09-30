package linthost

import "testing"

// TestEngineIndentCompoundsInsideGroup verifies an Indent inside a Group
// adds its width to every newline emitted by the broken group.
//
// Indent is how per-node printers express "this list level adds two
// columns of indentation". A regression here breaks the most basic
// readability invariant of a pretty printer — broken lists rendered
// flush against the left margin.
//
//  1. Build a Group whose contents are Hardline + Text wrapped in an
//     Indent of width 2 (default tabWidth).
//  2. Print under default options. The Group always breaks because of
//     the Hardline.
//  3. Assert the inner Text appears on its own line indented by 2
//     spaces.
//
// @evidence contracts/testing.md#behavioral-verification Print must indent inner by two spaces after the requested hard break.
// @evidence contracts/testing.md#independent-expectations Indent two applies precisely two literal columns to a continuation line while retaining inner.
// @evidence contracts/testing.md#distinguishing-cases This broken indentation case complements flat Indent neutrality and dynamic Align.
// @evidence contracts/testing.md#execution-ownership TestEngineIndentCompoundsInsideGroup is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineIndentCompoundsInsideGroup(t *testing.T) {
  doc := Group(Indent(2, Hardline(), Text("inner")))
  got := Print(doc, DefaultPrintOptions())
  if got != "\n  inner" {
    t.Fatalf("indent compound mismatch: %q", got)
  }
}
