package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsNewArgument verifies the rule
// emits no findings on a multi-line `new` expression under `mode: "es5"`.
//
// New-expression argument lists follow the es5 call-comma exclusion. No-comma abstention and existing-comma removal must both work without confusing an absent argument list with an existing one.
//
// 1. Parse the original comma-free list and a twin with a final comma.
// 2. Run format/trailing-comma with mode es5.
// 3. Require no findings for the original and exact comma removal for the twin.
//
// @evidence contracts/testing.md#behavioral-verification New-expression arguments without a trailing comma must remain untouched under es5. The corresponding existing final comma must be removed while retaining constructor declaration and argument order.
// @evidence contracts/testing.md#independent-expectations Prettier es5 excludes constructor-call argument commas. Literal full output retains new Foo, both values and the surrounding declaration while deleting only the forbidden comma.
// @evidence contracts/testing.md#distinguishing-cases The original new Foo argument-list negative remains and its comma-terminated removal counterpart exercises this distinct syntax owner. The all-mode new-argument host covers insertion.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5SkipsNewArgument owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5SkipsNewArgument(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2\n);\nr;\n",
    `{"mode":"es5"}`,
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2,\n);\nr;\n", `{"mode":"es5"}`,
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2\n);\nr;\n")
}
