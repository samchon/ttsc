package linthost

import "testing"

// TestFormatIndentNormalizesPlainMemberHeader verifies a plain (undecorated)
// class member header still indents to member depth after the decorator path
// was added.
//
// Regression guard: memberDeclarationStart returns -1 for a member with no
// decorators, so the header pass must fall back to its single re-indent of
// the declaration line exactly as before. A flush-left property must land at
// two spaces with no behavior change from the decorator work.
//
//  1. Parse a class with a flush-left plain property.
//  2. Apply the format/indent finding through the disk-backed fixer.
//  3. Assert the property header lands at two spaces.
func TestFormatIndentNormalizesPlainMemberHeader(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\nname: string = \"\";\n}\n",
    "class User {\n  name: string = \"\";\n}\n",
  )
}
