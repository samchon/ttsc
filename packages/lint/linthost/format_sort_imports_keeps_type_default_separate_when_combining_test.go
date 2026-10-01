package linthost

import "testing"

// TestFormatSortImportsKeepsTypeDefaultSeparateWhenCombining verifies a
// type-only default import is not folded into a value import even with
// combineTypeAndValue on.
//
// `import type D, { value }` would retype `value`, so the merge is refused and
// the declarations stay separate while still grouped and sorted.
//
//  1. Parse a type-only default import and a value import of the same module
//     plus a later-sorting third-party import.
//  2. Enable combineTypeAndValue and unsafe runtime sorting.
//  3. Assert the type-only default import stays its own declaration.
//
// @evidence contracts/testing.md#behavioral-verification Type-only default D must remain separate from value x when sorting both before z with combining enabled, retaining x use.
// @evidence contracts/testing.md#independent-expectations A merged clause-level type would erase x as a value binding; dropping type would promote D. The literal output independently preserves each binding phase under the supported combine safety contract.
// @evidence contracts/testing.md#distinguishing-cases A type-only default and runtime named value cannot merge. A type-only named binding can become inline type in the combines host, and a value default can legally merge in its own host.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsTypeDefaultSeparateWhenCombining owns the full-output mixed type-default/value-named protection fixture in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsKeepsTypeDefaultSeparateWhenCombining(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import type D from \"m\";\n" +
    "import { x } from \"m\";\n" +
    "x;\n"
  expected := "import type D from \"m\";\n" +
    "import { x } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "x;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true,"unsafeSortRuntimeImports":true}`, expected)
}
