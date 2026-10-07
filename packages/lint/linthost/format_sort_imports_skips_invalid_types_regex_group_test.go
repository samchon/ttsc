package linthost

import "testing"

// TestFormatSortImportsSkipsInvalidTypesRegexGroup verifies an uncompilable
// regex attached to a <TYPES> entry is skipped rather than crashing the run.
//
// `<TYPES>[` carries a bad trailing pattern; the group is dropped and the run
// proceeds with the remaining groups (here merging duplicate modules).
//
//  1. Parse two value imports of the same module.
//  2. Apply that order with unsafe runtime sorting enabled.
//  3. Assert the run merges the duplicates without crashing.
//
// @evidence contracts/testing.md#behavioral-verification An invalid TYPES regex must be ignored while duplicate m declarations merge into sorted a,b and both uses remain intact.
// @evidence contracts/testing.md#independent-expectations The supported malformed-group policy skips bad expressions while retaining the declared third-party fallback. Literal complete output independently specifies legal same-module merging.
// @evidence contracts/testing.md#distinguishing-cases The invalid pattern follows TYPES and an explicit fallback remains. The ordinary-invalid regex host differs in expression branch and implicit fallback ownership.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsSkipsInvalidTypesRegexGroup owns the authored invalid TYPES option input, explicit fallback and full merge oracle in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsSkipsInvalidTypesRegexGroup(t *testing.T) {
  source := "import { b } from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { a, b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<TYPES>[","<THIRD_PARTY_MODULES>"],"unsafeSortRuntimeImports":true}`, expected)
}
