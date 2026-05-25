package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastFunctionExpressionParameter verifies
// the rule reaches multi-line parameter lists on function expressions.
//
// Function expressions share the parameter-list handler with FunctionDeclaration,
// ArrowFunction, MethodDeclaration, Constructor, and the get/set accessors, but
// each Kind is its own `Visits()` arm dispatching through `AsFunctionExpression()`
// before reaching `considerFunctionParameterComma`. Pinning the function-expression
// arm separately keeps a future refactor that collapsed the shared handler from
// silently dropping FunctionExpression coverage — the rule comment cites
// "function parameter lists" as one of the rule's six in-scope shapes, and a
// regression on `const f = function (\n  ...\n)` would be invisible without
// this case.
//
// 1. Parse a source file with one multi-line function expression.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last parameter.
func TestFormatTrailingCommaInsertsAfterLastFunctionExpressionParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "const add = function (\n  left: number,\n  right: number\n): number {\n  return left + right;\n};\nadd;\n",
    "const add = function (\n  left: number,\n  right: number,\n): number {\n  return left + right;\n};\nadd;\n",
  )
}
