package linthost

import "testing"

// TestFormatTrailingCommaRemovesCallCommaUnderEs5 verifies that the `es5`
// policy removes a comma from a call argument list.
//
// Calls use the all comma level. Under es5, a final comma is forbidden on both multiline and single-line calls, while interior argument separators remain required.
//
// 1. Parse multiline and single-line calls whose final argument has a comma.
// 2. Apply format/trailing-comma with mode `es5`.
// 3. Assert the comma is removed.
//
// @evidence contracts/testing.md#behavioral-verification Es5 must remove the final call argument comma while retaining the first/second argument separator. Complete literal output detects preserving a forbidden comma or deleting an interior separator.
// @evidence contracts/testing.md#independent-expectations Official Prettier es5 excludes call argument trailing commas. The independently authored call output changes only the final punctuation and retains argument order.
// @evidence contracts/testing.md#distinguishing-cases The original multiline call removal stays, paired with a single-line removal case. HonorsModeEs5SkipsCallArgument covers the missing-comma fixed point and all-mode insertion covers the reverse decision.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaRemovesCallCommaUnderEs5 owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaRemovesCallCommaUnderEs5(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "call(\n  first,\n  second,\n);\n",
    `{"mode":"es5"}`,
    "call(\n  first,\n  second\n);\n",
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma", "call(first, second,);\n", `{"mode":"es5"}`, "call(first, second);\n")
}
