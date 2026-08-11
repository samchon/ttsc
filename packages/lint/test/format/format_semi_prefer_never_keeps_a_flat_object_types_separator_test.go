package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsAFlatObjectTypesSeparator verifies semi:false
// keeps the `;` between two members of an object type Prettier lays out
// flat, while still stripping both separators of one it breaks.
//
// Prettier prints a member separator as `ifBreak(semi, ";")`, and the flat
// branch of that `ifBreak` is a literal `";"` whatever `semi` says. So
// semi:false silences a separator only in a list it breaks: Prettier 3.8.3
// returns `type Flat = { alpha: number;\n  bravo: string };` with its `;`
// intact (collapsed onto one line, which this rule does not reflow) and
// `type Broken = {…}` with none. Reading only the newline at the member,
// which is what the strip did before, dropped a separator the oracle keeps.
// memberListBreaks is the same question insertMemberSemicolon asks from the
// other end, so the two directions now share one model of the wrap.
//
//  1. Parse a flat-opened object type whose members are split across lines
//     and a broken one whose members are terminated.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the flat type's separator survives, the broken type loses
//     both of its own, and both statement terminators go.
func TestFormatSemiPreferNeverKeepsAFlatObjectTypesSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type Flat = { alpha: number;\n  bravo: string };\n"+
      "type Broken = {\n  alpha: number;\n  bravo: string;\n};\n",
    `{"prefer":"never"}`,
    "type Flat = { alpha: number;\n  bravo: string }\n"+
      "type Broken = {\n  alpha: number\n  bravo: string\n}\n",
  )
}
