package linthost

import "testing"

// TestFormatDeclarationHeaderDropsBraceForClassBody verifies the opening
// brace lands on its own line for a class with a non-empty body whose
// header breaks, matching Prettier 3. The single `implements` clause keeps
// its types inline (two-tier tier one); only the brace moves down.
//
//  1. Parse a class whose flat implements header overflows 80, with a
//     non-empty body.
//  2. Apply format/declaration-header.
//  3. Assert the types stay inline and `{` is on its own line.
func TestFormatDeclarationHeaderDropsBraceForClassBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class Booooooooooooooo implements Firstttttttttttttttt, Secondddddddddddddddd, Third {\n  x = 1;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "class Booooooooooooooo\n  implements Firstttttttttttttttt, Secondddddddddddddddd, Third\n{\n  x = 1;\n}\n",
  )
}
