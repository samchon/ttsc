package linthost

import "testing"

// TestFormatSortImportsSkipsInvalidRegexGroup verifies an uncompilable regex
// entry in `order` is skipped rather than crashing the run.
//
// A bad pattern (`[`) is dropped; the remaining `^[.]` group still applies and
// the third-party catch-all (injected at the front when omitted) takes the
// unmatched specifier.
//
//  1. Parse a third-party and a relative import.
//  2. Apply that order with unsafe runtime sorting (the first entry is invalid).
//  3. Assert the run continues and groups by the surviving order.
//
// @evidence contracts/testing.md#behavioral-verification An invalid ordinary group pattern must not crash or block sorting; the output puts alpha before local and preserves both uses.
// @evidence contracts/testing.md#independent-expectations The supported malformed-order policy skips invalid expressions and supplies a third-party fallback. The literal full output independently defines the surviving relative-group behavior.
// @evidence contracts/testing.md#distinguishing-cases The first pattern is an unmatched opening bracket and the catch-all is omitted. The malformed TYPES-pattern peer covers another parser branch, while valid custom regexes have their own positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsSkipsInvalidRegexGroup owns the authored invalid-pattern option input and surviving-group complete-output oracle in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsSkipsInvalidRegexGroup(t *testing.T) {
  source := "import { b } from \"./local\";\n" +
    "import { a } from \"alpha\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { a } from \"alpha\";\n" +
    "import { b } from \"./local\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["[","^[.]"],"unsafeSortRuntimeImports":true}`, expected)
}
