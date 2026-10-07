package linthost

import "testing"

// TestFormatSortImportsKeepsNamespaceImportsSeparate verifies a namespace
// import is never folded into a named import of the same module.
//
// `import * as ns` cannot share a declaration with `{ named }`, so the rule
// keeps namespace declarations standalone while still sorting the block.
//
//  1. Parse a file with a namespace and a named import of the same module plus
//     a later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the namespace import stays its own declaration.
//
// @evidence contracts/testing.md#behavioral-verification Namespace ns and named a imports from m must remain separate before z while all ns,a,z uses remain unchanged.
// @evidence contracts/testing.md#independent-expectations TypeScript import grammar permits a namespace or named list after a default, not a combined namespace-plus-named slot. Literal output independently preserves both local bindings and valid syntax.
// @evidence contracts/testing.md#distinguishing-cases Namespace and named imports share a module but cannot fold into one named declaration. Default-plus-named merging is compatible, and identical namespaces supply the duplicate-input boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsNamespaceImportsSeparate owns its namespace/named source, exact complete sorted output and unsafe options in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsKeepsNamespaceImportsSeparate(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import * as ns from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "z;\n" +
    "ns;\n" +
    "a;\n"
  expected := "import * as ns from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n" +
    "ns;\n" +
    "a;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
