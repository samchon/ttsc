package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsCallArgument verifies the rule
// emits no findings on a multi-line call expression under `mode: "es5"`.
//
// The es5 call policy forbids final argument commas. Normalization must preserve a missing comma and remove an existing one, rather than returning early for every call.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification A multiline call without a final comma must receive no findings under es5. Its already comma-terminated counterpart must lose only the final argument comma.
// @evidence contracts/testing.md#independent-expectations Official Prettier options exclude call argument commas under es5. The literal call arguments and declaration remain identical while the authored removal oracle deletes the final comma.
// @evidence contracts/testing.md#distinguishing-cases The original two-argument call abstention stays and a pre-existing comma exercises removal in the same dispatch arm. The all-mode call host covers insertion.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsCallArgument owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsCallArgument(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "declare function foo(a: number, b: number): number;\nfoo(\n  1,\n  2\n);\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "declare function foo(a: number, b: number): number;\nfoo(\n  1,\n  2,\n);\n", `{"mode":"es5"}`,
    "declare function foo(a: number, b: number): number;\nfoo(\n  1,\n  2\n);\n")
}
