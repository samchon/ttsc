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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove both mapped-clause and outer alias terminators under never for broken and flat mapped types while retaining the mapped type meaning.
// @evidence contracts/testing.md#independent-expectations The independently authored full output follows semi:false mapped termination in both wraps and preserves both string-valued mapping declarations.
// @evidence contracts/testing.md#distinguishing-cases Flat and broken existing terminators both change under never, contrasting with default flat no-insertion and default broken insertion cases.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsAMappedTypeTerminator is a public Go unit selected by the lint semantic-unit Evidence claim. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
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
