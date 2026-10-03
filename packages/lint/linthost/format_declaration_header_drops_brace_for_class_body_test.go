package linthost

import "testing"

// TestFormatDeclarationHeaderDropsBraceForClassBody verifies the opening
// brace lands on its own line for a class with a non-empty body whose
// header breaks, matching Prettier 3. The single `implements` clause keeps
// its types inline on the keyword's continuation line (two-tier tier one),
// followed by a separate opening-brace line.
//
//  1. Parse a class whose flat implements header overflows 80, with a
//     non-empty body.
//  2. Apply format/declaration-header.
//  3. Assert the types stay inline and `{` is on its own line.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must place the nonempty class opening brace on its own line after a broken implements header, retaining all three types and x=1.
// @evidence contracts/testing.md#independent-expectations The independently authored full output follows nonempty-class brace layout; type order and the initializer/body delimiters are unchanged semantic payload.
// @evidence contracts/testing.md#distinguishing-cases This changed first-tier inline-types class contrasts with empty-body glued braces and second-tier one-type-per-line explosion.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderDropsBraceForClassBody is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatDeclarationHeaderDropsBraceForClassBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class Booooooooooooooo implements Firstttttttttttttttt, Secondddddddddddddddd, Third {\n  x = 1;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "class Booooooooooooooo\n  implements Firstttttttttttttttt, Secondddddddddddddddd, Third\n{\n  x = 1;\n}\n",
  )
}
