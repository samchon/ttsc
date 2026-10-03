package linthost

import "testing"

// TestEngineFlattenResolvesBreaksToFlatForm verifies the direct flatten
// helper's admitted projections and rejected Doc kinds.
//
// The mixed Group independently expects a by from Line, Softline and
// the flat IfBreak arm. Separate cases reject mandatory line breaks,
// a suffix, multiline Text, a nested mandatory break and a forced
// Group. Other cases admit an empty ConditionalGroup, select the first
// alternative and retain text beneath Indent/Align wrappers. The text-only
// wrapper fixture observes output, not the returned Doc variant. These fixtures
// do not exercise parsing or a complete hugged argument-list layout.
//
// @evidence contracts/testing.md#behavioral-verification flatten must yield a by for flat Line, Softline and IfBreak while rejecting the mandatory breaks, suffix, multiline Text, nested break and forced Group exercised here.
// @evidence contracts/testing.md#independent-expectations Doc algebra defines Line as a space, Softline as empty and IfBreak as its flat arm; literal outputs retain operand order.
// @evidence contracts/testing.md#distinguishing-cases Hardline, Literalline, suffix, newline text, nested break and forced Group are rejected; empty alternatives, first alternative and transparent wrappers are admitted.
// @evidence contracts/testing.md#execution-ownership TestEngineFlattenResolvesBreaksToFlatForm is one Go unit entry that calls the unexported flatten directly on literal Doc trees and renders the flat results with Print in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFlattenResolvesBreaksToFlatForm(t *testing.T) {
  flat, ok := flatten(Group(
    Text("a"), Line(), Softline(), Text("b"), IfBreak(Text("X"), Text("y")),
  ))
  if !ok {
    t.Fatal("flattenable doc: want ok=true")
  }
  if got := Print(flat, DefaultPrintOptions()); got != "a by" {
    t.Fatalf("flat form: want %q, got %q", "a by", got)
  }
  for name, doc := range map[string]Doc{
    "hardline":     Hardline(),
    "literalline":  Literalline(),
    "line-suffix":  LineSuffix(Text("c")),
    "newline-text": Text("a\nb"),
    "concat-break": Concat(Text("a"), Hardline()),
  } {
    if _, ok := flatten(doc); ok {
      t.Fatalf("%s: want not flattenable", name)
    }
  }
  forced := Group(Text("z"))
  forced.Break = true
  if _, ok := flatten(forced); ok {
    t.Fatal("forced-break group: want not flattenable")
  }
  if _, ok := flatten(ConditionalGroup()); !ok {
    t.Fatal("empty conditional group: want ok=true")
  }
  cg, ok := flatten(ConditionalGroup(Text("first"), Text("second")))
  if !ok || Print(cg, DefaultPrintOptions()) != "first" {
    t.Fatal("conditional group flatten: want its first option")
  }
  ind, ok := flatten(Indent(2, Align(Text("ab"))))
  if !ok || Print(ind, DefaultPrintOptions()) != "ab" {
    t.Fatal("indent/align should flatten transparently")
  }
}
