package linthost

import "testing"

// TestFormatPrintWidthKeepsEmptyArrayLiteralFlat verifies the rule
// abstains on an empty array literal regardless of the configured
// printWidth.
//
// The listShape printer special-cases empty children to `[]` with no
// internal whitespace, matching the empty-object case. If the rule
// attempted to reflow an empty array it would have no children to
// iterate over, which could trigger an out-of-bounds access or emit a
// no-op replacement that burns the idempotence check. The case pins
// the empty-array early-return at a tight printWidth so any regression
// that removes the guard is immediately visible.
//
//  1. Configure printWidth=1.
//  2. Feed `const x = [];`.
//  3. Assert the rule emits zero findings.
func TestFormatPrintWidthKeepsEmptyArrayLiteralFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = [];\n",
    `{"printWidth": 1}`,
  )
}
