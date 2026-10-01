package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastConstructorParameter verifies the rule
// reaches multi-line parameter lists on class constructors.
//
// A constructor parameter list owns property modifiers as well as ordinary parameter syntax. Adding its final comma must retain those property declarations.
//
//  1. Parse a source file with one class whose constructor parameter list spans
//     multiple lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The class constructor must gain only its final parameter comma while retaining both public x/y properties, their types and the empty body.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits the final constructor parameter comma. The literal output independently preserves property modifiers and class structure while changing terminal punctuation.
// @evidence contracts/testing.md#distinguishing-cases The constructor has two public parameter properties and a separate closer line. ES5 constructor removal and stacked-property hosts distinguish mode and modifier spelling.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastConstructorParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastConstructorParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "class Point {\n  constructor(\n    public x: number,\n    public y: number\n  ) {}\n}\nPoint;\n",
    "class Point {\n  constructor(\n    public x: number,\n    public y: number,\n  ) {}\n}\nPoint;\n",
  )
}
