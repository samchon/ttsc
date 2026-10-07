package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsArrowParameter verifies the
// rule emits no findings on a multi-line arrow-function parameter list
// under `mode: "es5"`.
//
// The es5 parameter policy forbids a final comma rather than skipping this node entirely. Both the no-comma fixed point and removal of a pre-existing comma must work for arrows.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification Arrow parameters without a final comma must remain untouched under es5; an existing final comma must be removed while preserving the arrow return type and body.
// @evidence contracts/testing.md#independent-expectations Prettier es5 excludes function parameter trailing commas. Both unchanged missing-comma input and literal removal output follow that option policy independently of the parameter scanner.
// @evidence contracts/testing.md#distinguishing-cases The original multiline parenthesized arrow negative remains, paired with its already-comma-terminated removal case. The all-mode arrow insertion host supplies the other mode direction.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsArrowParameter owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsArrowParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "const add = (\n  a: number,\n  b: number\n): number => a + b;\nadd;\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "const add = (\n  a: number,\n  b: number,\n): number => a + b;\nadd;\n", `{"mode":"es5"}`,
    "const add = (\n  a: number,\n  b: number\n): number => a + b;\nadd;\n")
}
