package linthost

import "testing"

// TestFormatIndentNormalizesDecoratedMemberDeclarationLine verifies a
// decorated class member's DECLARATION line is re-indented alongside its
// decorator line.
//
// The header pass re-indents lineStart(SkipTrivia(member.Pos())), but for a
// decorated member member.Pos() is the leading `@`, so only the decorator
// line moved while the `name: type` declaration on the next line stayed at
// its original column — a half-indented member Prettier never emits. The fix
// also re-indents the declaration line (the first token past the last
// decorator) to the member's nesting depth.
//
//  1. Parse a class whose decorator and declaration lines are flush left.
//  2. Apply the format/indent finding through the disk-backed fixer.
//  3. Assert BOTH lines land at two-space member depth.
func TestFormatIndentNormalizesDecoratedMemberDeclarationLine(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\n@Column()\nname: string = \"\";\n}\n",
    "class User {\n  @Column()\n  name: string = \"\";\n}\n",
  )
}
