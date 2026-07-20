package linthost

import "testing"

// TestFormatTrailingCommaModeNoneRemovesTrailingComma verifies that `none`
// actively removes an existing trailing comma.
//
// A no-op only hid inputs that were already in the desired shape. The option
// is a formatting policy, so a list carrying an otherwise legal comma must be
// normalized in the opposite direction as well.
//
// 1. Parse a list that already has its final comma.
// 2. Apply format/trailing-comma with mode `none`.
// 3. Assert the final comma is removed.
func TestFormatTrailingCommaModeNoneRemovesTrailingComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "const values = [\n  first,\n  second,\n];\n",
    `{"mode":"none"}`,
    "const values = [\n  first,\n  second\n];\n",
  )
}
