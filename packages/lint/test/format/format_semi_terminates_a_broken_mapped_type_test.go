package linthost

import "testing"

// TestFormatSemiTerminatesABrokenMappedType verifies a mapped type whose
// body is written across lines takes its terminator, through every modifier
// spelling.
//
// A mapped type is not a member list: `{ readonly [K in T as N]?: V }` holds
// one clause, typescript-go hangs its parts off the MappedTypeNode itself,
// and the optional `;` is consumed by parseSemicolon outside every child's
// range, so no member node exists to carry it. The kind was absent from the
// rule's Visits list entirely, which left every broken mapped type in a
// typed codebase unterminated. The modifiers are here because they were
// measured rather than assumed: `readonly`, its `+`/`-` variants, `+?`/`-?`,
// and an `as` clause all come back from Prettier 3.8.3 terminated the same
// way, so none of them needs its own answer.
//
//  1. Parse four broken mapped types covering `readonly`, `+readonly`/`+?`,
//     `-readonly`/`-?`, and an `as` clause with `?`.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert each clause gains a `;` before its closing brace.
func TestFormatSemiTerminatesABrokenMappedType(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type A = {\n  readonly [K in string]: string\n};\n"+
      "type B = {\n  +readonly [K in string]+?: string\n};\n"+
      "type C = {\n  -readonly [K in string]-?: string\n};\n"+
      "type D = {\n  [K in string as `p${K}`]?: string\n};\n",
    "type A = {\n  readonly [K in string]: string;\n};\n"+
      "type B = {\n  +readonly [K in string]+?: string;\n};\n"+
      "type C = {\n  -readonly [K in string]-?: string;\n};\n"+
      "type D = {\n  [K in string as `p${K}`]?: string;\n};\n",
  )
}
