package linthost

import "testing"

// TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma verifies
// the reflow breaks an overflowing array destructuring assignment target
// ending in a rest (`[a, ...rest] = arr`) WITHOUT appending a trailing comma.
//
// Arrays have no objectWrap:"preserve", so the suppression must be exercised
// through a genuine width-driven break: the flat form overflows printWidth,
// the reflow explodes it one element per line, and the printer's AddComma
// would otherwise put a comma after the AssignmentRestElement (a syntax
// error). The rest-target guard keeps the exploded shape valid.
//
// 1. Configure printWidth=20 and feed a single-line array rest target that overflows.
// 2. Run formatPrintWidth so the array breaks one element per line.
// 3. Assert the broken output has no trailing comma after the rest element.
// @evidence contracts/testing.md#behavioral-verification Applies format/print-width at printWidth 20 to `[alpha, ...restItems] = sourceArray;` and requires the exact output `[\n  alpha,\n  ...restItems\n] = sourceArray;\n` with no comma after the rest element.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal; a trailing comma after a rest element in an assignment target is a syntax error, so omitting it is required rather than derived from the printer.
// @evidence contracts/testing.md#distinguishing-cases One changing case where a width-driven break would normally add a trailing comma; the rest-target guard distinguishes the valid output from `...restItems,`. Object-pattern rest targets are owned by a separate test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls assertFixSnapshotWithOptions, applying the rule's edits to a temp-dir file; no child process, built binary or installed consumer.
func TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "[alpha, ...restItems] = sourceArray;\n",
    `{"printWidth": 20}`,
    "[\n  alpha,\n  ...restItems\n] = sourceArray;\n",
  )
}
