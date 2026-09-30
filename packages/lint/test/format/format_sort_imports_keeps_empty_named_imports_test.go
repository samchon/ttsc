package linthost

import "testing"

// TestFormatSortImportsKeepsEmptyNamedImports verifies two empty named imports
// of the same module are not collapsed into a malformed declaration.
//
// A merge that would yield neither a default binding nor any specifier is
// rejected; the originals are kept so `import {} from "m"` never degrades to
// `import  from "m"`.
//
//  1. Parse two `import {}` declarations from the same module plus a
//     later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the empty imports survive as separate declarations.
//
// @evidence contracts/testing.md#behavioral-verification Both empty named imports from m must remain valid separate declarations before z, with z use unchanged.
// @evidence contracts/testing.md#independent-expectations A merge result with neither default nor named bindings cannot be emitted as import from. The literal complete source preserves both authored dependency declarations under the supported empty-bucket policy.
// @evidence contracts/testing.md#distinguishing-cases Two empty runtime declarations contrast nonempty duplicate-module merging and the empty type-named plus type-default legal merge boundary. Unsafe sorting is explicitly allowed.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsEmptyNamedImports owns its literal empty-binding declarations, complete sorted output and unsafe options in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsKeepsEmptyNamedImports(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import {} from \"m\";\n" +
    "import {} from \"m\";\n" +
    "z;\n"
  expected := "import {} from \"m\";\n" +
    "import {} from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
