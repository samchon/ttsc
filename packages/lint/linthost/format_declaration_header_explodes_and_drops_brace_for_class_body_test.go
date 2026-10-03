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
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must compose one-type-per-line heritage explosion with a standalone brace for a nonempty class, retaining four implemented types and x=1.
// @evidence contracts/testing.md#independent-expectations The literal full output independently specifies the second-tier width-eighty class layout and unchanged declaration/body payload, without using the implementation to generate an oracle.
// @evidence contracts/testing.md#distinguishing-cases This changed header still exceeds width after a simple clause break; the three-type first-tier case and empty-class brace case own adjacent layout decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderExplodesAndDropsBraceForClassBody is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatDeclarationHeaderExplodesAndDropsBraceForClassBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class Booooooooooooooo implements Firstttttttttttttttt, Secondddddddddddddddd, Thirddddddddddddddddd, Fourthhhhhhhhhhhhhhh {\n  x = 1;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "class Booooooooooooooo\n  implements\n    Firstttttttttttttttt,\n    Secondddddddddddddddd,\n    Thirddddddddddddddddd,\n    Fourthhhhhhhhhhhhhhh\n{\n  x = 1;\n}\n",
  )
}
