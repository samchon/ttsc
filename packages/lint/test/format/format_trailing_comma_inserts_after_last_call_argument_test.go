package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastCallArgument verifies the trailing
// comma reaches multi-line call expressions.
//
// An ordinary call with a broken final-argument boundary is eligible under all mode. Existing commas inside an object argument must not be confused with the outer call comma.
//
// 1. Parse a source file with one multi-line call site.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification JSON.stringify must gain only the comma after its final argument 2, retaining the already comma-terminated object, null argument and argument order.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits terminal commas in broken calls. The literal expected call changes only its final punctuation and independently preserves all three values.
// @evidence contracts/testing.md#distinguishing-cases The final argument and call closer occupy different lines; the same-line-close host is negative, and ES5 call hosts exercise exclusion/removal.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastCallArgument owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastCallArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "JSON.stringify(\n  {\n    a: 1,\n    b: 2,\n  },\n  null,\n  2\n);\n",
    "JSON.stringify(\n  {\n    a: 1,\n    b: 2,\n  },\n  null,\n  2,\n);\n",
  )
}
