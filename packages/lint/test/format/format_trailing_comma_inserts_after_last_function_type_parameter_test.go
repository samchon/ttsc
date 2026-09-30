package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastFunctionTypeParameter verifies
// the rule reaches multi-line parameter lists on TypeScript function
// type literals (`(a, b) => T`).
//
// Function-type parameter lists live in type space but still need all-mode terminal punctuation. Their return type must remain outside the edit.
//
//  1. Parse a source file with one type alias whose body is a
//     multi-line function type literal.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The function type must gain a comma after right:number while retaining both parameter types and the numeric result type.
// @evidence contracts/testing.md#independent-expectations TypeScript function types use formal-parameter comma grammar, which Prettier all mode permits. The literal expected type is independent of runtime function AST ownership.
// @evidence contracts/testing.md#distinguishing-cases The type alias has no runtime body, contrasting the expression/declaration positives and the constructor-type peer with its new marker.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastFunctionTypeParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastFunctionTypeParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "type BinaryOp = (\n  left: number,\n  right: number\n) => number;\nlet f: BinaryOp;\nf;\n",
    "type BinaryOp = (\n  left: number,\n  right: number,\n) => number;\nlet f: BinaryOp;\nf;\n",
  )
}
