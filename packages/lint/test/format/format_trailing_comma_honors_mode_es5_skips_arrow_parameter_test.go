package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsArrowParameter verifies the
// rule emits no findings on a multi-line arrow-function parameter list
// under `mode: "es5"`.
//
// Arrow functions postdate ES5 entirely and their parameter-list trailing
// commas arrived with the rest of the post-ES5 stack. Prettier excludes
// them from `trailingComma: "es5"`; the `KindArrowFunction` arm
// short-circuits on the es5 guard. Pinning the skip keeps the arrow
// branch parity with the broader parameter-list family.
//
// 1. Parse a source file with one multi-line parenthesized arrow.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsArrowParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "const add = (\n  a: number,\n  b: number\n): number => a + b;\nadd;\n",
    `{"mode":"es5"}`,
  )
}
