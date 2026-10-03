package linthost

import "testing"

// TestFormatDeclarationHeaderGluesBraceForEmptyBody verifies an empty body
// keeps `{}` glued to the last header line even for a class, matching
// Prettier 3 (it drops `{` onto its own line only for a class with a
// non-empty body).
//
//  1. Parse a class whose multi-clause header overflows 80, with an empty
//     body.
//  2. Apply format/declaration-header.
//  3. Assert each clause breaks and the brace stays glued to the last one.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must break the exported class heritage clauses while keeping empty-body braces attached to the last implements line.
// @evidence contracts/testing.md#independent-expectations The complete expected source literal records empty-body brace ownership independently and retains export, class name, base and both implemented types.
// @evidence contracts/testing.md#distinguishing-cases The changed overflowing empty class contrasts with the nonempty-class standalone-brace positive and the empty-body eighty-column boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderGluesBraceForEmptyBody is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatDeclarationHeaderGluesBraceForEmptyBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "export class Fooooooooooo extends Baaaaaaaaaar implements Iiiiiiiiii, Jjjjjjjjjj {}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "export class Fooooooooooo\n  extends Baaaaaaaaaar\n  implements Iiiiiiiiii, Jjjjjjjjjj {}\n",
  )
}
