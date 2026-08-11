package linthost

import "testing"

// TestFormatSemiPreferNeverStripsAMappedTypeTerminator verifies semi:false
// removes a mapped type's `;` in both layouts.
//
// Prettier prints the terminator as `options.semi ? ifBreak(";") : ""`, so
// semi:false silences it outright — the wrap does not enter into it, unlike
// the insert direction where `ifBreak` still has to ask. Prettier 3.8.3
// returns both a broken and a flat mapped type with nothing before the
// closing brace, so the strip needs no break test and the two directions
// deliberately differ. Removing the `;` cannot change the parse either:
// only the `}` can follow it, and ASI's closing-brace rule applies whatever
// the line structure.
//
//  1. Parse a broken mapped type and a flat one, both terminated.
//  2. Apply format/semi with prefer:"never".
//  3. Assert both terminators and both statement terminators go.
func TestFormatSemiPreferNeverStripsAMappedTypeTerminator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type A = {\n  [K in string]: string;\n};\n"+
      "type B = { [K in string]: string; };\n",
    `{"prefer":"never"}`,
    "type A = {\n  [K in string]: string\n}\n"+
      "type B = { [K in string]: string }\n",
  )
}
