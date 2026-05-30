package linthost

import "testing"

// TestFormatDeclarationHeaderExplodesAndDropsBraceForClassBody verifies the
// two most complex header pieces compose: tier-two (one type per line, when
// the inline-after-break line still overflows) AND a class non-empty body's
// brace on its own line. Matches Prettier 3.8.3.
//
//  1. Parse a class whose implements list overflows even inline-after-break,
//     with a non-empty body.
//  2. Apply format/declaration-header at printWidth 80.
//  3. Assert each type is on its own line and `{` stands alone.
func TestFormatDeclarationHeaderExplodesAndDropsBraceForClassBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class Booooooooooooooo implements Firstttttttttttttttt, Secondddddddddddddddd, Thirddddddddddddddddd, Fourthhhhhhhhhhhhhhh {\n  x = 1;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "class Booooooooooooooo\n  implements\n    Firstttttttttttttttt,\n    Secondddddddddddddddd,\n    Thirddddddddddddddddd,\n    Fourthhhhhhhhhhhhhhh\n{\n  x = 1;\n}\n",
  )
}
