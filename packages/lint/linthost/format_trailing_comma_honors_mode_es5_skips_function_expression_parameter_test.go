package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsFunctionExpressionParameter
// verifies the rule emits no findings on a multi-line function expression
// parameter list under `mode: "es5"`.
//
// Function expressions have a separate syntax owner but share the es5 parameter-comma exclusion. The no-comma fixed point and existing-comma removal both belong to that policy.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification Function-expression parameters must stay comma-free under es5, and an existing final comma must be removed while preserving the numeric return type and addition body.
// @evidence contracts/testing.md#independent-expectations Prettier es5 excludes function parameter commas for expressions as well as declarations. The authored full output independently retains a/b and their body while deleting only the forbidden comma.
// @evidence contracts/testing.md#distinguishing-cases The original function-expression no-finding input remains beside its final-comma removal counterpart. The all-mode expression insertion host distinguishes mode from AST ownership.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsFunctionExpressionParameter owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsFunctionExpressionParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "const add = function (\n  a: number,\n  b: number\n): number {\n  return a + b;\n};\nadd;\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "const add = function (\n  a: number,\n  b: number,\n): number {\n  return a + b;\n};\nadd;\n", `{"mode":"es5"}`,
    "const add = function (\n  a: number,\n  b: number\n): number {\n  return a + b;\n};\nadd;\n")
}
