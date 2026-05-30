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
func TestFormatDeclarationHeaderGluesBraceForEmptyBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "export class Fooooooooooo extends Baaaaaaaaaar implements Iiiiiiiiii, Jjjjjjjjjj {}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "export class Fooooooooooo\n  extends Baaaaaaaaaar\n  implements Iiiiiiiiii, Jjjjjjjjjj {}\n",
  )
}
