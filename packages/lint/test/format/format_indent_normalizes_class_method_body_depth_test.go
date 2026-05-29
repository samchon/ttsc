package linthost

import "testing"

// TestFormatIndentNormalizesClassMethodBodyDepth verifies a class method
// body statement lands at depth 2 (four spaces) under the default
// tabWidth.
//
// A class body is a descend-only +1 frame: it is not a statement list,
// but a method's Block nests inside it, adding another +1, so a
// method-body statement sits at depth 2. Without counting the class-body
// frame the statement would land one column short. This pins that fix.
//
//  1. Parse a class whose method body statement is flush left.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the body statement is re-indented to four spaces.
func TestFormatIndentNormalizesClassMethodBodyDepth(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class C {\n  m() {\nreturn 1;\n  }\n}\n",
    "class C {\n  m() {\n    return 1;\n  }\n}\n",
  )
}
