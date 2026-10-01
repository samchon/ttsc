package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter verifies
// the rule emits no findings on a multi-line setter parameter under
// `mode: "es5"`.
//
// A setter accepts one parameter, so its es5 final-comma policy still needs both a comma-free fixed point and removal of an existing comma. The getter empty-list boundary is separate.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification The single setter parameter must remain comma-free under es5. An existing final comma must be removed without changing its assigned value or private backing field.
// @evidence contracts/testing.md#independent-expectations Prettier es5 excludes setter parameter commas, while installed 3.8.3 all mode permits a comma after the sole parameter. The authored removal oracle independently retains the setter program.
// @evidence contracts/testing.md#distinguishing-cases The original one-parameter setter negative remains with its final-comma removal counterpart. The all-mode setter insertion host covers the permitted opposite mode; a getter has no parameter item.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number\n  ) {\n    this._value = next;\n  }\n}\nBox;\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number,\n  ) {\n    this._value = next;\n  }\n}\nBox;\n", `{"mode":"es5"}`,
    "class Box {\n  private _value = 0;\n  set value(\n    next: number\n  ) {\n    this._value = next;\n  }\n}\nBox;\n")
}
