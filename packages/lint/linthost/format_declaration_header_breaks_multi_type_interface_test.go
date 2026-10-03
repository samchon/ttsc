package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksMultiTypeInterface verifies a single
// `extends` clause with multiple types breaks before the keyword and
// lists one type per line, matching Prettier 3.
//
// The full independent output requires both the keyword break and all six
// separate heritage lines. The rule reflows only the header up to `{`; the
// body is untouched. This case does not reproduce a past formatter version.
//
//  1. Parse an interface whose extends list overflows printWidth 50.
//  2. Apply format/declaration-header.
//  3. Assert the keyword breaks and each type lands on its own line.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must expand the over-width six-type extends clause onto one type per line, preserving order and the number-typed member body.
// @evidence contracts/testing.md#independent-expectations The literal output expresses the Prettier-three layout independently; the named First through Sixth heritage sequence and a:number remain identical in meaning.
// @evidence contracts/testing.md#distinguishing-cases The changed overflowing multi-type clause complements fitting or singleton heritage layouts and the comment-bearing header guard; exact output verifies change plus body preservation.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderBreaksMultiTypeInterface is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatDeclarationHeaderBreaksMultiTypeInterface(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface B extends First, Second, Third, Fourth, Fifth, Sixth {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "interface B\n  extends\n    First,\n    Second,\n    Third,\n    Fourth,\n    Fifth,\n    Sixth {\n  a: number;\n}\n",
  )
}
