package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsFunctionExpressionParameter
// verifies the rule emits no findings on a multi-line function expression
// parameter list under `mode: "es5"`.
//
// ES5 grammar disallowed trailing commas in parameter lists; prettier's
// `trailingComma: "es5"` skips them accordingly. Function expressions
// route through their own `KindFunctionExpression` dispatch arm with
// the es5 short-circuit before `considerFunctionParameterComma`. Pinning
// the skip protects the arm against a regression that drops the guard.
//
// 1. Parse a source file with one multi-line function expression.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsFunctionExpressionParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "const add = function (\n  a: number,\n  b: number\n): number {\n  return a + b;\n};\nadd;\n",
    `{"mode":"es5"}`,
  )
}
