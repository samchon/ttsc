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
//
// @evidence contracts/testing.md#behavioral-verification Type-default D plus empty type-named import must collapse to legal default-only type D from m.
// @evidence contracts/testing.md#independent-expectations Official TypeScript restricts default-plus-named type imports; an empty list contributes no binding. The literal default-only result independently retains D and type erasure.
// @evidence contracts/testing.md#distinguishing-cases Empty named contribution permits a merge, contrasting the nonempty A protection peers in both combine modes. Runtime-empty named imports have their own no-binding preservation host.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsMergesTypeDefaultWithEmptyNamed owns the authored empty-named/type-default boundary snapshot in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsMergesTypeDefaultWithEmptyNamed(t *testing.T) {
  source := "import type D from \"m\";\n" +
    "import type {} from \"m\";\n"
  expected := "import type D from \"m\";\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
