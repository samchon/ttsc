package linthost

import "testing"

// TestFormatSemiTerminatesABrokenMappedType verifies a mapped type whose
// body is written across lines takes its terminator, through every modifier
// spelling.
//
// A mapped type is not a member list: `{ readonly [K in T as N]?: V }` holds
// one clause, typescript-go hangs its parts off the MappedTypeNode itself,
// and the optional `;` is consumed by parseSemicolon outside every child's
// range, so no member node exists to carry it. The current mapped-type
// path locates the typed clause end independently of those modifier parts.
// These four authored modifier/remapping inputs specify identical default
// termination while retaining every modifier byte; this entry itself does
// not perform a reference measurement or establish earlier visitor history.

//  1. Parse four broken mapped types covering `readonly`, `+readonly`/`+?`,
//     `-readonly`/`-?`, and an `as` clause with `?`.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert each clause gains a `;` before its closing brace.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must insert a mapped-clause terminator for readonly, plus/minus readonly/optional modifiers and a template-literal key remapping while preserving every modifier and type.
// @evidence contracts/testing.md#independent-expectations The independently authored full output preserves the four mapped declarations and inserts only the clause-ending semicolons; modifier spelling cannot alter that default termination policy.
// @evidence contracts/testing.md#distinguishing-cases Four modifier/remapping forms require a change in one batch; flat and already-terminated mapped clauses own the adjacent no-op cases.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiTerminatesABrokenMappedType is a public Go unit selected by the lint semantic-unit Evidence claim. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
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
