package linthost

import "testing"

// TestEngineFitsFirstLineStopsAtFirstBreak verifies fitsFirstLine
// measures literal prefixes before an exposed break, including multiline
// Text and a directly encountered IfBreak's broken branch. It checks negative
// budget, overflow, all four exposed line kinds, a text-only wrapped Group,
// nested first alternatives and zero-width operands. Group-contained Line
// flattening is distinguished by the neighboring exact-width case.
//
// @evidence contracts/testing.md#behavioral-verification fitsFirstLine must stop at actual first breaks while rejecting prefixes already wider than the budget.
// @evidence contracts/testing.md#independent-expectations Literal prefix lengths and the first-line contract define the verdicts, including multiline Text and broken IfBreak.
// @evidence contracts/testing.md#distinguishing-cases Negative remaining, overflowing prefix, each break kind, transparent wrappers, nested alternatives and zero-width operands have separate assertions.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsFirstLineStopsAtFirstBreak is one Go unit entry that calls the unexported fitsFirstLine directly on twelve literal Doc trees in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsFirstLineStopsAtFirstBreak(t *testing.T) {
  if fitsFirstLine(Text("x"), -1) {
    t.Fatal("negative remaining: want false")
  }
  if !fitsFirstLine(Concat(Text("abc"), Hardline(), Text("ignored-tail")), 5) {
    t.Fatal("text then hardline within budget: want true")
  }
  if fitsFirstLine(Text("toolong"), 3) {
    t.Fatal("text overflowing before any break: want false")
  }
  if !fitsFirstLine(Text("ab\ncdefghij"), 5) {
    t.Fatal("multi-line text whose first line fits: want true")
  }
  if fitsFirstLine(Text("abcdef\ng"), 3) {
    t.Fatal("multi-line text whose first line overflows: want false")
  }
  if !fitsFirstLine(Concat(Text("ab"), Line()), 5) {
    t.Fatal("Line ends the first line: want true")
  }
  if !fitsFirstLine(Concat(Text("ab"), Softline()), 5) {
    t.Fatal("Softline ends the first line: want true")
  }
  if !fitsFirstLine(Concat(Text("ab"), Literalline()), 5) {
    t.Fatal("Literalline ends the first line: want true")
  }
  if !fitsFirstLine(Concat(Text("a"), IfBreak(Hardline(), Text("xxxxxxxx"))), 3) {
    t.Fatal("IfBreak takes its break branch: want true")
  }
  if !fitsFirstLine(Indent(2, Align(Group(Text("ab")))), 5) {
    t.Fatal("Indent/Align/Group are transparent: want true")
  }
  if !fitsFirstLine(ConditionalGroup(Text("ab"), Text("zzzzzzzz")), 5) {
    t.Fatal("nested ConditionalGroup measures its first option: want true")
  }
  if !fitsFirstLine(Concat(Doc{}, LineSuffix(Text("c")), Text("ab")), 5) {
    t.Fatal("nil and LineSuffix contribute no width: want true")
  }
}
