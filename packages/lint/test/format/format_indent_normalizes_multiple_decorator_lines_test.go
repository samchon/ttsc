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
func TestFormatIndentNormalizesMultipleDecoratorLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\n@Index()\n@Column({ nullable: true })\nemail?: string;\n}\n",
    "class User {\n  @Index()\n  @Column({ nullable: true })\n  email?: string;\n}\n",
  )
}
