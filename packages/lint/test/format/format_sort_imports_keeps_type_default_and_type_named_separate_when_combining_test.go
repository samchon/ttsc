package linthost

import "testing"

// TestFormatSortImportsKeepsTypeDefaultAndTypeNamedSeparateWhenCombining
// verifies the TS1363 guard also holds when `combineTypeAndValue` routes the
// two type-only declarations through the shared value merge key.
//
// With `combineTypeAndValue: true` both declarations land in the `v\0m`
// bucket instead of `t\0m`, but the bucket is still wholly type-only, so a
// merge would produce the same illegal `import type D, { A } from "m"`
// shape. The guard keys off the merged type-only state, not the bucket key,
// so both option settings refuse the merge.
//
//  1. Parse a type-only default import and a type-only named import of the
//     same module plus a later-sorting third-party import.
//  2. Enable combineTypeAndValue and unsafe runtime sorting.
//  3. Assert the two type-only declarations stay separate, sorted first.
func TestFormatSortImportsKeepsTypeDefaultAndTypeNamedSeparateWhenCombining(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import type D from \"m\";\n" +
    "import type { A } from \"m\";\n" +
    "z;\n"
  expected := "import type D from \"m\";\n" +
    "import type { A } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true,"unsafeSortRuntimeImports":true}`, expected)
}
