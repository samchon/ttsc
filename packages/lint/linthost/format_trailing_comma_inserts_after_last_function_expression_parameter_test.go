package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastFunctionExpressionParameter verifies
// the rule reaches multi-line parameter lists on function expressions.
//
// Function expressions share formal-parameter punctuation with declarations but have a different syntax owner. The final comma must not disturb their binding or body.
//
// 1. Parse a source file with one multi-line function expression.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The function expression must gain a comma after right:number while retaining its binding, numeric return annotation and addition body.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode applies formal-parameter commas to function expressions. Literal expected source retains left/right and every surrounding token independently of expression/declaration dispatch.
// @evidence contracts/testing.md#distinguishing-cases The expression lives in a const initializer, distinct from a function declaration. Its ES5 peer supplies no-comma and removal cases.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastFunctionExpressionParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastFunctionExpressionParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const add = function (\n  left: number,\n  right: number\n): number {\n  return left + right;\n};\nadd;\n",
    "const add = function (\n  left: number,\n  right: number,\n): number {\n  return left + right;\n};\nadd;\n",
  )
}
