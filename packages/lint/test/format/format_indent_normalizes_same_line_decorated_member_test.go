package linthost

import "testing"

// TestFormatIndentNormalizesSameLineDecoratedMember verifies a member whose
// decorator and declaration share one physical line is re-indented exactly
// once, to member depth.
//
// For `@Column() name: string` the decorator's End() and the declaration
// start resolve to the same physical line the decorator pass already
// handles, so the second re-indent must be a no-op rather than a duplicate
// or conflicting edit. This guards the same-line decorator boundary.
//
//  1. Parse a class with a single same-line decorated member at column 0.
//  2. Apply the format/indent finding through the disk-backed fixer.
//  3. Assert the one line lands at two spaces and is otherwise untouched.
func TestFormatIndentNormalizesSameLineDecoratedMember(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\n@Column() name: string = \"\";\n}\n",
    "class User {\n  @Column() name: string = \"\";\n}\n",
  )
}
