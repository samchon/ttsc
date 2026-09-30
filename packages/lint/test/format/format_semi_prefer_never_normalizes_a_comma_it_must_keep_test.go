package linthost

import "testing"

// TestFormatSemiPreferNeverNormalizesACommaItMustKeep verifies a `,` that
// semi:false cannot drop is still spelled `;`, the two shapes at once.
//
// This is the negative twin of the strip: semi:false silences only the
// separators Prettier itself omits, and every separator it keeps it prints
// as `;`. Prettier 3.8.3 returns `{ alpha: number, bravo: string }` as
// `{ alpha: number; bravo: string }` under semi:false, because the flat
// branch of `ifBreak(semi, ";")` is a literal `";"` whatever `semi` says;
// and it prints `charlie: number;` ahead of a call signature for the same
// ASI reason this rule refuses to drop a separator there. Leaving the
// written `,` in either place would keep a spelling the oracle never emits.
//
//  1. Parse a flat type literal separated with `,` and an interface whose
//     `,` precedes a call signature.
//  2. Apply format/semi with prefer:"never".
//  3. Assert both commas become `;` while the statement terminator is
//     stripped.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must normalize required commas to semicolons for a flat type list and before a call signature while removing the safe outer alias terminator under never.
// @evidence contracts/testing.md#independent-expectations The independently authored full output preserves the flat-list and call-signature separation required for type syntax while retaining every annotation and callable member.
// @evidence contracts/testing.md#distinguishing-cases One flat-list separator and one call-signature hazard separator must remain but change spelling; the safe statement terminator disappears and the broken-interface comma-removal case owns the opposing decision.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverNormalizesACommaItMustKeep is a public Go unit selected by TestSelectedLintUnits. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
func TestFormatSemiPreferNeverNormalizesACommaItMustKeep(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type Flat = { alpha: number, bravo: string };\n"+
      "interface Call {\n  charlie: number,\n  (): void\n}\n",
    `{"prefer":"never"}`,
    "type Flat = { alpha: number; bravo: string }\n"+
      "interface Call {\n  charlie: number;\n  (): void\n}\n",
  )
}
