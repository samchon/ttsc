package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsConstructorParameter verifies
// the rule emits no findings on a multi-line constructor parameter list
// under `mode: "es5"`.
//
// Constructor parameters follow the es5 function-parameter exclusion. That exclusion requires removing an existing final comma while preserving the parameter properties.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification Constructor property parameters without a trailing comma must remain untouched under es5; the same list with a final comma must lose it without changing public property modifiers.
// @evidence contracts/testing.md#independent-expectations Prettier es5 excludes constructor parameter commas. Literal removal preserves x/y property ownership, types and constructor body independently of the shared parameter handler.
// @evidence contracts/testing.md#distinguishing-cases The original public-property constructor negative remains and its final-comma counterpart supplies removal. The all-mode constructor and modifier-stacked hosts supply insertion positives.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsConstructorParameter owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsConstructorParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "class Point {\n  constructor(\n    public x: number,\n    public y: number\n  ) {}\n}\nPoint;\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "class Point {\n  constructor(\n    public x: number,\n    public y: number,\n  ) {}\n}\nPoint;\n", `{"mode":"es5"}`,
    "class Point {\n  constructor(\n    public x: number,\n    public y: number\n  ) {}\n}\nPoint;\n")
}
