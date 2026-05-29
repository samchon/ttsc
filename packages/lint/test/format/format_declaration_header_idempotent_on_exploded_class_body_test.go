package linthost

import "testing"

// TestFormatDeclarationHeaderIdempotentOnExplodedClassBody verifies the rule
// reproduces its most complex output shape byte-for-byte so the cascade
// converges: tier-two one-type-per-line plus a class brace on its own line.
//
//  1. Parse a class header already in the exploded + own-line-brace shape.
//  2. Run format/declaration-header at printWidth 80.
//  3. Assert the rule reports nothing.
func TestFormatDeclarationHeaderIdempotentOnExplodedClassBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "class Booooooooooooooo\n  implements\n    Firstttttttttttttttt,\n    Secondddddddddddddddd,\n    Thirddddddddddddddddd,\n    Fourthhhhhhhhhhhhhhh\n{\n  x = 1;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
