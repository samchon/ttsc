package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastMethodParameter verifies the rule
// reaches multi-line parameter lists on class method declarations.
//
// A class method has its own parameter-bearing syntax owner. Normalizing its final comma must preserve the method body and containing class.
//
//  1. Parse a source file with one class containing a method whose parameter
//     list spans multiple lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The Calculator method must gain only the comma after right:number while retaining class ownership, return annotation and addition body.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits final commas in broken class-method formal parameters. The literal output independently preserves left/right and their runtime computation.
// @evidence contracts/testing.md#distinguishing-cases The method has a body and class owner, distinct from top-level functions and body-free method signatures. Its ES5 peer covers the forbidden-comma policy.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastMethodParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastMethodParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "class Calculator {\n  add(\n    left: number,\n    right: number\n  ): number {\n    return left + right;\n  }\n}\nCalculator;\n",
    "class Calculator {\n  add(\n    left: number,\n    right: number,\n  ): number {\n    return left + right;\n  }\n}\nCalculator;\n",
  )
}
