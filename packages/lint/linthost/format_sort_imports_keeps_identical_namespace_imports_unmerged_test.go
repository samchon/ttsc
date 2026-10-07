package linthost

import "testing"

// TestFormatSortImportsKeepsIdenticalNamespaceImportsUnmerged verifies two
// byte-identical `default, * as ns` imports are re-emitted verbatim rather
// than merged into a namespace-less declaration.
//
// mergeKey isolates namespace imports by embedding the original text in the
// key, so two byte-identical declarations (a duplicate-binding error
// TypeScript reports later, which the parse-level formatter still sees)
// collide into one bucket. Without the namespace guard in `renderMergedDecl`
// the rebuilt statement would keep only the default binding and silently
// drop `* as N`.
//
//  1. Parse two identical `import D, * as N` declarations plus a
//     later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert both namespace declarations survive verbatim, sorted first.
//
// @evidence contracts/testing.md#behavioral-verification Both identical D plus namespace N imports must remain separate and verbatim before z, preserving all namespace text and z use.
// @evidence contracts/testing.md#independent-expectations Duplicate-binding input remains visible to a syntax-only formatter. The literal full output independently forbids dropping either namespace clause while fixing the permitted module order.
// @evidence contracts/testing.md#distinguishing-cases Two byte-identical default/namespace declarations distinguish repeated-key safety from different namespace/named siblings. Identical commented-import hosts cover another protected payload shape.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsIdenticalNamespaceImportsUnmerged owns its duplicate namespace parse input and exact two-copy output under unsafe sorting in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsKeepsIdenticalNamespaceImportsUnmerged(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import D, * as N from \"m\";\n" +
    "import D, * as N from \"m\";\n" +
    "z;\n"
  expected := "import D, * as N from \"m\";\n" +
    "import D, * as N from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
