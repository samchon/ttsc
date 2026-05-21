package linthost

import "testing"

// TestEngineFitsFirstLineStopsAtFirstBreak verifies fitsFirstLine
// measures only the columns up to a doc's first line break and treats
// every break point as broken.
//
// fitsFirstLine decides ConditionalGroup option selection: an option is
// eligible when its opening line fits even though later lines wrap. The
// measurement must end at the first Line/Softline/Hardline/Literalline,
// take an IfBreak's break branch, see through Concat/Indent/Align/Group
// wrappers, descend into a nested ConditionalGroup's first option, and
// reject content that overflows before any break.
//
//  1. Call fitsFirstLine on each break-shaped and wrapper-shaped doc.
//  2. Assert each fit/no-fit verdict.
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
