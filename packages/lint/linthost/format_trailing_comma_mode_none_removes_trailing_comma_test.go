package linthost

import "testing"

// TestFormatTrailingCommaModeNoneRemovesTrailingComma verifies that `none`
// actively removes an existing trailing comma.
//
// None is an active normalization policy. It must remove a pre-existing comma even on a single-line list and leave an already comma-free list alone.
//
// 1. Parse multiline and single-line arrays with a final comma.
// 2. Apply format/trailing-comma with mode `none`.
// 3. Require exact final-comma removal and no findings on the comma-free twin.
//
// @evidence contracts/testing.md#behavioral-verification None mode must remove only the final array comma and preserve both elements and their separator. Complete source prevents a no-op or deletion of the separator between first and second.
// @evidence contracts/testing.md#independent-expectations Official Prettier none policy disallows trailing commas. The literal expected array keeps item order and deletes exactly the authored final comma independently of the comma scanner.
// @evidence contracts/testing.md#distinguishing-cases The original multiline removal remains, with single-line removal and an already comma-free no-finding case added. All-mode array insertion provides the reverse policy.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaModeNoneRemovesTrailingComma owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaModeNoneRemovesTrailingComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "const values = [\n  first,\n  second,\n];\n",
    `{"mode":"none"}`,
    "const values = [\n  first,\n  second\n];\n",
  )
  assertFixSnapshotWithOptions(t, "format/trailing-comma", "const values = [first, second,];\n", `{"mode":"none"}`, "const values = [first, second];\n")
  assertRuleSkipsSourceWithOptions(t, "format/trailing-comma", "const values = [first, second];\n", `{"mode":"none"}`)
}
