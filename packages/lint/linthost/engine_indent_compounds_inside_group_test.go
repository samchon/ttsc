package linthost

import "testing"

// TestEngineIndentCompoundsInsideGroup verifies an Indent inside a Group
// adds two indentation columns to the requested Hardline before literal
// inner. This single-level case expects a leading LF plus two spaces; it
// does not claim literal-line indentation or arbitrary nested increments.
//
// @evidence contracts/testing.md#behavioral-verification Print must indent inner by two spaces after the requested hard break.
// @evidence contracts/testing.md#independent-expectations Indent two applies precisely two literal columns to a continuation line while retaining inner.
// @evidence contracts/testing.md#distinguishing-cases This broken indentation case complements flat Indent neutrality and dynamic Align.
// @evidence contracts/testing.md#execution-ownership TestEngineIndentCompoundsInsideGroup is one Go unit entry that renders a literal Group holding one Indent and a Hardline with Print under default options in-process; it parses no source and installs, builds and launches nothing.
func TestEngineIndentCompoundsInsideGroup(t *testing.T) {
  doc := Group(Indent(2, Hardline(), Text("inner")))
  got := Print(doc, DefaultPrintOptions())
  if got != "\n  inner" {
    t.Fatalf("indent compound mismatch: %q", got)
  }
}
