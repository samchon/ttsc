package linthost

import "testing"

// TestFormatIndentNormalizesMultipleDecoratorLines verifies a member with
// several decorators on their own lines lands the declaration line at member
// depth past the LAST decorator.
//
// The declaration start is computed from the final decorator's End(), not
// the first, so a multi-decorator member must still re-indent the real
// declaration line (and each decorator line is handled by the same header
// pass). This guards the "last decorator" boundary in the fix.
//
//  1. Parse a class with two decorators and a declaration, all flush left.
//  2. Apply the format/indent finding through the disk-backed fixer.
//  3. Assert every decorator line and the declaration line land at two
//     spaces.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must indent both separate decorator lines and the property declaration after the last decorator. Complete output catches taking the first decorator boundary and forgetting the actual declaration line.
// @evidence contracts/testing.md#independent-expectations The supported member layout aligns all leading decorators and the declaration at two spaces. Literal Index(), Column options, optional email marker and type remain unchanged program content.
// @evidence contracts/testing.md#distinguishing-cases This positive owns two decorators and the declaration following the final one. The single-decorator and same-line hosts distinguish singleton and shared-line declaration boundaries.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesMultipleDecoratorLines owns its entire fixture and expected source in the public Go unit population. The syntax-only owning rule and edit application execute in the same process without a consumer install, native artifact build or actual product host.
func TestFormatIndentNormalizesMultipleDecoratorLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\n@Index()\n@Column({ nullable: true })\nemail?: string;\n}\n",
    "class User {\n  @Index()\n  @Column({ nullable: true })\n  email?: string;\n}\n",
  )
}
