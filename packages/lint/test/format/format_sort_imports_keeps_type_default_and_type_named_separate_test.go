package linthost

import "testing"

// TestFormatSortImportsKeepsTypeDefaultAndTypeNamedSeparate verifies a
// type-only default import and a type-only named import of the same module
// are not merged into one declaration.
//
// Locks the all-type-only guard in `renderMergedDecl`: merging would emit
// `import type D, { A } from "m"`, which TypeScript rejects with TS1363 ("A
// type-only import can specify a default import or named bindings, but not
// both"), breaking the file for every later re-parse. The merge is refused
// and both declarations survive, still grouped and sorted.
//
//  1. Parse a type-only default import and a type-only named import of the
//     same module plus a later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the two type-only declarations stay separate, sorted first.
func TestFormatSortImportsKeepsTypeDefaultAndTypeNamedSeparate(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import type D from \"m\";\n" +
    "import type { A } from \"m\";\n" +
    "z;\n"
  expected := "import type D from \"m\";\n" +
    "import type { A } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
