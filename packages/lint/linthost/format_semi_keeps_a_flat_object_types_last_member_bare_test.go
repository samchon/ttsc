package linthost

import "testing"

// TestFormatSemiKeepsAFlatObjectTypesLastMemberBare verifies an object type
// the author opened on one line keeps its last member bare, wherever the
// closing brace landed.
//
// Prettier preserves an object type's wrap by the break between its `{`
// and its first member, not by where the `}` sits, and prints the trailing
// terminator only for a list it breaks. It returns
// `type Flat = { flat: number\n};` as `type Flat = { flat: number };`, so
// reading the newline at the member would insert a `;` the oracle never
// prints. The two terminators that are still owed are the contrast: a
// separator between two members is printed in either layout, and an
// interface body always breaks however its member's own type was written.
//
//  1. Parse a flat-opened object type, a flat-opened one whose members are
//     split, and an interface member whose type is a flat-opened literal.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert only the inter-member separator and the interface member gain
//     a `;`.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must leave a flat-opened type literal last member bare, add an interior member separator, and terminate an outer interface member without terminating its inner flat literal.
// @evidence contracts/testing.md#independent-expectations The independently authored full output specifies list ownership at each opening brace; retained flat last members and inserted outer/interior semicolons preserve all nested type annotations.
// @evidence contracts/testing.md#distinguishing-cases Three literal declarations distinguish flat trailing, flat interior and outer broken-interface punctuation within one batch, rejecting a member-newline-only heuristic.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsAFlatObjectTypesLastMemberBare is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiKeepsAFlatObjectTypesLastMemberBare(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type Flat = { flat: number\n};\n"+
      "type Split = { alpha: number\n  bravo: string };\n"+
      "interface Outer {\n  nested: { inner: number\n  }\n}\n",
    "type Flat = { flat: number\n};\n"+
      "type Split = { alpha: number;\n  bravo: string };\n"+
      "interface Outer {\n  nested: { inner: number\n  };\n}\n",
  )
}
