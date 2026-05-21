package linthost

import "testing"

// TestEngineFlattenResolvesBreaksToFlatForm verifies flatten collapses a
// doc to its single-line rendering and reports docs that cannot render
// flat.
//
// flatten produces the all-flat ConditionalGroup option for a hugged
// argument list. It must resolve Line to a space, Softline and IfBreak
// to their flat forms, and see through Group/Concat/Indent/Align — and
// it must refuse a doc carrying a Hardline, Literalline, LineSuffix,
// multi-line Text or a forced-broken Group.
//
//  1. Flatten a doc mixing every flattenable kind and assert the
//     rendered flat string.
//  2. Flatten each non-flattenable kind and assert ok is false.
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
