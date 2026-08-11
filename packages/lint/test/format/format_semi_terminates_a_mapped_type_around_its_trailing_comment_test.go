package linthost

import "testing"

// TestFormatSemiTerminatesAMappedTypeAroundItsTrailingComment verifies the
// mapped-type terminator lands on the side of a trailing comment Prettier
// puts it on, which is not the same side for both comment kinds.
//
// Prettier attaches a same-line trailing block comment to the mapped type's
// value type and prints the terminator after it, while a line comment
// becomes the mapped type's dangling comment and is printed after the
// terminator. Prettier 3.8.3 returns `string; // note` and
// `string /* note */;` from the two inputs below. This is also the one place
// a mapped type and an ordinary member disagree — a member takes its `;` at
// End(), ahead of the same block comment — so the offset cannot simply be
// borrowed from the member path.
//
//  1. Parse a broken mapped type trailed by a line comment and another
//     trailed by a block comment.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert the `;` lands before the line comment and after the block
//     comment, with both comments intact.
func TestFormatSemiTerminatesAMappedTypeAroundItsTrailingComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type A = {\n  [K in string]: string // note\n};\n"+
      "type B = {\n  [K in string]: string /* note */\n};\n",
    "type A = {\n  [K in string]: string; // note\n};\n"+
      "type B = {\n  [K in string]: string /* note */;\n};\n",
  )
}
