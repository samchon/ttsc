package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5ForEnumMembers verifies enum members
// use Prettier's ES5 comma level.
//
// Enum comma policy follows the formatter option level rather than the age of enum syntax. A missing enum dispatch must not silently skip the final-member comma.
//
// 1. Parse a multi-line enum without a final comma.
// 2. Apply format/trailing-comma with mode `es5`.
// 3. Assert the final member gains a trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification Enum Direction must gain only the comma after Down under mode es5; complete source preserves Up, the enum name and brace layout.
// @evidence contracts/testing.md#independent-expectations The independently authored Down-comma output specifies the enum comma policy at the es5 option level, preserving the enum name, both member names and brace layout. The expectation is a literal fixture oracle rather than a value generated from the visited-kind table; this entry does not run a reference formatter.
// @evidence contracts/testing.md#distinguishing-cases The broken enum is positive under es5. None-removal and terminated-list hosts cover the opposite normalization and canonical fixed point.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaHonorsModeEs5ForEnumMembers owns each literal source, option and expected output in the public Go unit population. The syntax-only owning rule and edit/no-finding harness run in one process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaHonorsModeEs5ForEnumMembers(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "enum Direction {\n  Up,\n  Down\n}\n",
    `{"mode":"es5"}`,
    "enum Direction {\n  Up,\n  Down,\n}\n",
  )
}
