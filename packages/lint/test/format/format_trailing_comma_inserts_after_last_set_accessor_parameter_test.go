package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastSetAccessorParameter verifies the rule
// reaches the (singular) parameter on a multi-line setter declaration.
//
// A setter has one formal parameter and can carry its final comma under all mode. This differs from a getter with no parameter item.
//
//  1. Parse a source file with one class whose setter parameter spans multiple
//     lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the parameter.
//
// @evidence contracts/testing.md#behavioral-verification The setter must gain a comma after its sole next:number parameter while retaining the backing field and assignment body.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 permits a final comma in a broken setter parameter list under all mode. The literal expected class independently preserves its one-parameter setter behavior.
// @evidence contracts/testing.md#distinguishing-cases The setter has exactly one parameter, unlike a zero-parameter getter. Its ES5 peer covers both comma-free abstention and forbidden-comma removal.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastSetAccessorParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastSetAccessorParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number\n  ) {\n    this._value = next;\n  }\n}\nBox;\n",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number,\n  ) {\n    this._value = next;\n  }\n}\nBox;\n",
  )
}
