package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsMethodParameter verifies the
// rule emits no findings on a multi-line class-method parameter list
// under `mode: "es5"`.
//
// Method parameters follow the es5 parameter-comma exclusion. The rule must normalize an existing comma away as well as abstaining on an already comma-free method.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification Class-method parameters without a trailing comma must produce no findings under es5. An existing comma after b must be removed while leaving Calculator and its addition body intact.
// @evidence contracts/testing.md#independent-expectations Prettier es5 excludes method parameter commas. The literal complete removal output preserves both parameter declarations and return expression independently of the method dispatch arm.
// @evidence contracts/testing.md#distinguishing-cases The original class-method negative stays and its already comma-terminated counterpart supplies removal. The all-mode method host supplies insertion under the permissive mode.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsMethodParameter owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsMethodParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "class Calculator {\n  add(\n    a: number,\n    b: number\n  ): number {\n    return a + b;\n  }\n}\nCalculator;\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "class Calculator {\n  add(\n    a: number,\n    b: number,\n  ): number {\n    return a + b;\n  }\n}\nCalculator;\n", `{"mode":"es5"}`,
    "class Calculator {\n  add(\n    a: number,\n    b: number\n  ): number {\n    return a + b;\n  }\n}\nCalculator;\n")
}
