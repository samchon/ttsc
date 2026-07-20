package linthost

import "testing"

// TestFormatTrailingCommaRemovesCallCommaUnderEs5 verifies that the `es5`
// policy removes a comma from a call argument list.
//
// Calls use Prettier's `all` level. They must not gain a comma under `es5`,
// but they also must not preserve one that was already present.
//
// 1. Parse a multi-line call whose final argument has a comma.
// 2. Apply format/trailing-comma with mode `es5`.
// 3. Assert the comma is removed.
func TestFormatTrailingCommaRemovesCallCommaUnderEs5(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "call(\n  first,\n  second,\n);\n",
    `{"mode":"es5"}`,
    "call(\n  first,\n  second\n);\n",
  )
}
