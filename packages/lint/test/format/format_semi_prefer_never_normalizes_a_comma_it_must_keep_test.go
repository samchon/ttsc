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
