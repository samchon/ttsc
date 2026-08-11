package linthost

import "testing"

// TestFormatSemiTerminatesAMappedTypeWithoutATypeAnnotation verifies the
// terminator still lands when the mapped type has no `: V` to end at.
//
// The value annotation is optional, and the parser's own token nodes stop
// short of the punctuation that closes the clause without it: the type
// parameter and the `as` name type both end before the `]`, and a `+`/`-`
// modifier is parsed as the question token with the `?` it decorates
// consumed by a bare parseExpected. Anchoring the insert on the last child's
// End() alone would put the `;` inside the brackets. Prettier 3.8.3 prints
// `[K in string];` and `[K in string]?;`, so the offset has to step over the
// trailing `]` and `?` the way the parser skipped them.
//
//  1. Parse three broken mapped types with no value annotation: a bare one,
//     one ending in `?`, and one with an `as` clause.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert each `;` lands after the clause's last written byte.
func TestFormatSemiTerminatesAMappedTypeWithoutATypeAnnotation(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type A = {\n  [K in string]\n};\n"+
      "type B = {\n  readonly [K in string]?\n};\n"+
      "type C = {\n  [K in string as `p${K}`]\n};\n",
    "type A = {\n  [K in string];\n};\n"+
      "type B = {\n  readonly [K in string]?;\n};\n"+
      "type C = {\n  [K in string as `p${K}`];\n};\n",
  )
}
