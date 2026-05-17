package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsMethodParameter verifies the
// rule emits no findings on a multi-line class-method parameter list
// under `mode: "es5"`.
//
// Class methods are an ES2015 feature; ES5 grammar disallows trailing
// commas in their parameter lists. The `KindMethodDeclaration` dispatch
// arm short-circuits on the es5 guard before reaching
// `considerFunctionParameterComma`. Pinning the skip keeps the
// class-member parameter path regression-safe.
//
// 1. Parse a source file with one class containing a multi-line method.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsMethodParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "class Calculator {\n  add(\n    a: number,\n    b: number\n  ): number {\n    return a + b;\n  }\n}\nCalculator;\n",
    `{"mode":"es5"}`,
  )
}
