package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5IncludesTypeLevelLists verifies that
// Prettier's `es5` level includes tuple types and type parameters.
//
// The old test encoded a source-level reading of the option rather than the
// pinned formatter's behavior. Prettier treats those lists as its default ES5
// comma level, so both must gain the comma that a multi-line array receives.
//
// 1. Parse a multi-line tuple and type-parameter declaration.
// 2. Apply format/trailing-comma with mode `es5`.
// 3. Assert both type-level lists gain a trailing comma.
func TestFormatTrailingCommaHonorsModeEs5IncludesTypeLevelLists(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/trailing-comma",
    "type Pair = [\n  First,\n  Second\n];\nfunction pair<\n  First,\n  Second\n>() {}\n",
    `{"mode":"es5"}`,
    "type Pair = [\n  First,\n  Second,\n];\nfunction pair<\n  First,\n  Second,\n>() {}\n",
  )
}
