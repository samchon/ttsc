package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastObjectProperty verifies trailing
// commas land on multi-line object literals.
//
// An ordinary object value list must add only its final separator. Property keys, values and order remain outside the edit.
//
// 1. Parse a source file with one multi-line object literal.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The object must gain a comma after b:2 while retaining a:1, property order and object binding.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits terminal commas in broken object value lists. The literal expected object independently preserves all property keys and values.
// @evidence contracts/testing.md#distinguishing-cases This ordinary-property value positive differs from value spread, assignment rest and non-rest target hosts. Empty and terminated objects are negative boundaries.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastObjectProperty owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastObjectProperty(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const obj = {\n  a: 1,\n  b: 2\n};\n",
    "const obj = {\n  a: 1,\n  b: 2,\n};\n",
  )
}
