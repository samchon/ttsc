package linthost

import "testing"

// TestFormatIndentHonorsCustomTabWidth verifies the rule scales the
// space indent by a custom `tabWidth`.
//
// Under tabWidth 4 a depth-1 statement sits at four spaces, not the
// default two. This pins that `format/indent` multiplies depth by the
// configured tabWidth.
//
//  1. Parse a function whose body statement is flush left.
//  2. Apply the rule with `{"tabWidth":4}` through the disk-backed fixer.
//  3. Assert the body statement is indented to four spaces.
func TestFormatIndentHonorsCustomTabWidth(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "function f() {\nreturn 1;\n}\n",
    `{"tabWidth":4}`,
    "function f() {\n    return 1;\n}\n",
  )
}
