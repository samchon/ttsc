package linthost

import "testing"

// TestFormatSortImportsMergesTypeDefaultWithEmptyNamed verifies a type-only
// default import still merges with an empty type-only named import of the
// same module.
//
// Boundary of the TS1363 guard in `renderMergedDecl`: the guard refuses a
// type-only default only when merged named specifiers exist. An empty named
// list contributes none, so the bucket folds to the legal default-only form
// `import type D from "m"` instead of falling back to two declarations.
//
//  1. Parse a type-only default import and an empty type-only named import
//     of the same module.
//  2. Apply the rule with default options.
//  3. Assert one merged default-only `import type` declaration.
func TestFormatSortImportsMergesTypeDefaultWithEmptyNamed(t *testing.T) {
  source := "import type D from \"m\";\n" +
    "import type {} from \"m\";\n"
  expected := "import type D from \"m\";\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
