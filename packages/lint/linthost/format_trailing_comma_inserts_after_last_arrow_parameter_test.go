package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastArrowParameter verifies the rule
// reaches multi-line parameter lists on arrow functions.
//
// A parenthesized arrow has a real parameter-list closer before its return annotation and arrow token. The comma belongs after the last parameter, not at a later body parenthesis.
//
// 1. Parse a source file with one multi-line arrow function.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The parenthesized arrow must gain a comma after right:number while retaining its return annotation and left+right body.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits terminal commas in broken arrow parameter lists. The authored literal output preserves both parameters and the arrow grammar independently of the close-token scanner.
// @evidence contracts/testing.md#distinguishing-cases The fully parenthesized two-parameter arrow is positive; ES5 removal and unparenthesized-arrow hosts distinguish option policy and absence of list parentheses.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastArrowParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastArrowParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const add = (\n  left: number,\n  right: number\n): number => left + right;\nadd;\n",
    "const add = (\n  left: number,\n  right: number,\n): number => left + right;\nadd;\n",
  )
}
