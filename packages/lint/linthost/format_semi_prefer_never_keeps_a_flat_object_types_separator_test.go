package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsAFlatObjectTypesSeparator verifies semi:false
// keeps the `;` between two members of an object type Prettier lays out
// flat, while still stripping both separators of one it breaks.
//
// Prettier prints a member separator as `ifBreak(semi, ";")`, and the flat
// branch of that `ifBreak` is a literal `";"` whatever `semi` says. So
// The direct rule uses the opening-brace wrap decision to keep a flat-opened
// interior separator, even when a later member starts on a new line. The
// independently authored output retains that layout; it does not assert
// a complete Prettier reflow or a historical implementation result.
// memberListBreaks is the same question insertMemberSemicolon asks from the
// other end, so the two directions now share one model of the wrap.
//
//  1. Parse a flat-opened object type whose members are split across lines
//     and a broken one whose members are terminated.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the flat type's separator survives, the broken type loses
//     both of its own, and both statement terminators go.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must keep a flat-opened type-list interior separator while removing both broken-list member separators and both alias terminators under never.
// @evidence contracts/testing.md#independent-expectations The independent full output distinguishes list wrap at its opening brace and preserves both alpha:number/bravo:string member pairs; a member newline alone cannot determine retention.
// @evidence contracts/testing.md#distinguishing-cases Flat-opened later-split and genuinely broken type lists share one fixture as retained/removed interior twins, with safe trailing statement punctuation removed in both.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverKeepsAFlatObjectTypesSeparator is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
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
