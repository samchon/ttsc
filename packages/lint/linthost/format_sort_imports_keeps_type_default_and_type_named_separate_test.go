package linthost

import "testing"

// TestFormatSortImportsKeepsTypeDefaultAndTypeNamedSeparate verifies a
// type-only default import and a type-only named import of the same module
// are not merged into one declaration.
//
// Locks the all-type-only guard in `renderMergedDecl`: merging would emit
// `import type D, { A } from "m"`, which TypeScript rejects with TS1363 ("A
// type-only import can specify a default import or named bindings, but not
// both"). The merge is refused to preserve valid type-only declarations
// and both declarations survive, still grouped and sorted.
//
//  1. Parse a type-only default import and a type-only named import of the
//     same module plus a later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the two type-only declarations stay separate, sorted first.
//
// @evidence contracts/testing.md#behavioral-verification Sorting must place both m imports before z while retaining separate type-default D and type-named A declarations and the z use.
// @evidence contracts/testing.md#independent-expectations The official TypeScript Modules Reference prohibits a type-only declaration from containing both default and named bindings. Literal separate declarations preserve legal type syntax under permitted sorting.
// @evidence contracts/testing.md#distinguishing-cases Both m declarations are type-only but contribute default and named bindings. The combine-enabled twin covers the alternative key path; the empty-named peer supplies the legal merge boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsTypeDefaultAndTypeNamedSeparate owns the authored type-default/type-named sorting snapshot and unsafe options in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
