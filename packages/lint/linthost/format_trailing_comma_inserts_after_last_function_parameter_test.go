package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastFunctionParameter verifies the rule
// reaches multi-line function parameter lists.
//
// The parameter list ends before its closing parenthesis; the return annotation follows that parenthesis. The comma must follow the last parameter, and only trivia may intervene before the closer.
//
// 1. Parse a source file with one multi-line function declaration.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The function declaration must gain only the comma after right:number while retaining its numeric return type and left+right body.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits a final comma in this broken formal-parameter list. The literal expected declaration independently preserves its signature and body.
// @evidence contracts/testing.md#distinguishing-cases The return annotation follows the closing parenthesis, while the comma belongs before it. Arrow, expression and method peers exercise other parameter owners; ES5 mixed-list tests supply exclusion.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastFunctionParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastFunctionParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "function add(\n  left: number,\n  right: number\n): number {\n  return left + right;\n}\n",
    "function add(\n  left: number,\n  right: number,\n): number {\n  return left + right;\n}\n",
  )
}
