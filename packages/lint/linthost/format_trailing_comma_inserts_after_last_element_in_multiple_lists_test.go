package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastElementInMultipleLists verifies
// `applyTextEditsToFile`'s original-offset preservation when two independent
// multi-line lists in the same source each need a trailing comma.
//
// Multiple edits must preserve the original position of each final item. Applying an insertion against already shifted offsets can damage a later list, so the complete two-array output verifies their combined application.
//
//  1. Parse a source file with two multi-line array literals, neither
//     carrying a trailing comma.
//  2. Apply the rule's findings through the disk-backed fixer.
//  3. Assert both lists gain trailing commas at the correct positions.
//
// @evidence contracts/testing.md#behavioral-verification Both arrays in one source must gain exactly their final commas while retaining every element. Complete output detects applying later insertions against source offsets shifted by an earlier edit.
// @evidence contracts/testing.md#independent-expectations Each authored multiline array independently requires its all-mode terminal comma. The literal complete file specifies both insertion positions without deriving order or output from the edit application implementation.
// @evidence contracts/testing.md#distinguishing-cases Two independent arrays require two edits in one file, unlike a sole-list snapshot. The mixed ES5 array/function and terminated-array/object hosts independently cover eligible/ineligible and canonical populations.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastElementInMultipleLists owns the two-array literal source and complete expected edited file in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native builds or product-host children.
func TestFormatTrailingCommaInsertsAfterLastElementInMultipleLists(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const xs = [\n  1,\n  2\n];\nconst ys = [\n  3,\n  4\n];\n",
    "const xs = [\n  1,\n  2,\n];\nconst ys = [\n  3,\n  4,\n];\n",
  )
}
