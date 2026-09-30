package linthost

import "testing"

// TestFormatIndentNormalizesDecoratedMemberDeclarationLine verifies a
// decorated class member's DECLARATION line is re-indented alongside its
// decorator line.
//
// The header pass re-indents lineStart(SkipTrivia(member.Pos())), but for a
// decorated member member.Pos() is the leading `@`, so only the decorator
// line moved while the `name: type` declaration on the next line stayed at
// its original column, a half-indented member Prettier never emits. The fix
// also re-indents the declaration line (the first token past the last
// decorator) to the member's nesting depth.
//
//  1. Parse a class whose decorator and declaration lines are flush left.
//  2. Apply the format/indent finding through the disk-backed fixer.
//  3. Assert BOTH lines land at two-space member depth.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must indent both the decorator line and the following property declaration to two spaces. Complete source distinguishes fixing only the first decorator while leaving a half-indented member.
// @evidence contracts/testing.md#independent-expectations The supported class-member layout aligns leading decorators and the actual declaration at the member column. Literal expected source retains Column(), the property type and empty-string initializer independently of AST position helpers.
// @evidence contracts/testing.md#distinguishing-cases This positive starts both lines at column zero. The canonical decorated-member negative, multiple-decorator positive and same-line decorator exact-edit host cover adjacent declaration-position decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesDecoratedMemberDeclarationLine owns its source and complete output in the public Go unit population. The syntax-only owning rule/edit application runs in process without consumer installation, native compilation or a real product host.
func TestFormatIndentNormalizesDecoratedMemberDeclarationLine(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\n@Column()\nname: string = \"\";\n}\n",
    "class User {\n  @Column()\n  name: string = \"\";\n}\n",
  )
}
