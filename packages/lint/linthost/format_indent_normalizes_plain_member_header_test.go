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
//
// @evidence contracts/testing.md#behavioral-verification format/indent must indent a plain flush-left class property to two spaces. The literal full output detects a decorator-specific change accidentally removing ordinary member-header handling.
// @evidence contracts/testing.md#independent-expectations The supported class-member column is one default indentation level, regardless of whether decorators exist. Expected source preserves the name, string type and empty initializer independently of decorator helpers.
// @evidence contracts/testing.md#distinguishing-cases The property has no decorators, contrasting with separate-line, same-line and multiple-decorator positives. The canonical class-member/body hosts cover unchanged already-correct layout.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesPlainMemberHeader owns its literal source and output in the public Go unit population. The owning syntax-only operation and edit application execute in process without installing a consumer, building native artifacts or starting a product host.
func TestFormatIndentNormalizesPlainMemberHeader(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "class User {\nname: string = \"\";\n}\n",
    "class User {\n  name: string = \"\";\n}\n",
  )
}
