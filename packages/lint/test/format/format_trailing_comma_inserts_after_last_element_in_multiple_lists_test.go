package main

import "testing"

// TestFormatTrailingCommaInsertsAfterLastElementInMultipleLists verifies
// `applyTextEditsToFile`'s reverse-splice invariant when two independent
// multi-line lists in the same source each need a trailing comma.
//
// The trailing-comma rule emits a single zero-width insertion at
// `last.End()` per list. When two lists in one file both qualify, the
// engine sorts findings by Pos ascending and splices in reverse so each
// edit operates against the untouched offsets of every prior edit.
// A future refactor to forward iteration would land the second array's
// comma inside the first array — silently corrupting source, since every
// existing trailing-comma test exercises only a single list per fixture.
// Pinning the two-array shape guarantees the splice order is preserved.
//
//  1. Parse a source file with two multi-line array literals, neither
//     carrying a trailing comma.
//  2. Apply the rule's findings through the disk-backed fixer.
//  3. Assert both lists gain trailing commas at the correct positions.
func TestFormatTrailingCommaInsertsAfterLastElementInMultipleLists(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const xs = [\n  1,\n  2\n];\nconst ys = [\n  3,\n  4\n];\n",
    "const xs = [\n  1,\n  2,\n];\nconst ys = [\n  3,\n  4,\n];\n",
  )
}
