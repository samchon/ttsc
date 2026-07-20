package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5ForEnumMembers verifies enum members
// use Prettier's default ES5 comma level.
//
// Enums were absent from the visited-kind list, which made all modes silently
// skip a multi-line enum body. The registered rule must visit that declaration
// and apply the same policy used for arrays and named specifiers.
//
// 1. Parse a multi-line enum without a final comma.
// 2. Apply format/trailing-comma with mode `es5`.
// 3. Assert the final member gains a trailing comma.
func TestFormatTrailingCommaHonorsModeEs5ForEnumMembers(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "enum Direction {\n  Up,\n  Down\n}\n",
    `{"mode":"es5"}`,
    "enum Direction {\n  Up,\n  Down,\n}\n",
  )
}
