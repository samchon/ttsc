package linthost

import "testing"

// TestFormatIndentStripsLeadingIndentFromTopLevelStatement verifies
// formatIndent removes the leading indentation of a top-level statement.
//
// Top-level statements live at depth 0, so the desired indent is the
// empty string. A leading two-space run differs from "" and is replaced,
// fixing the headline bug's stray leading indent.
//
//  1. Parse a file whose only statement is indented two spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the statement now starts at column 0.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must remove the two-space prefix from a top-level const statement. Complete source detects retaining stray leading indentation or altering the declaration while moving it.
// @evidence contracts/testing.md#independent-expectations The supported top-level column is zero, so the literal expected source has no leading whitespace. The binding, initializer and terminator remain identical independently of the rule depth calculation.
// @evidence contracts/testing.md#distinguishing-cases This singleton top-level positive repairs two spaces to the empty indentation run. Ordinary block and class-method positives cover nonzero destinations, while fixed-point hosts cover already-correct indentation.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentStripsLeadingIndentFromTopLevelStatement owns its literal source/output in the public Go unit population. The owning syntax-only rule and edit application run in process without consumer installation, native artifact production or a real product host.
func TestFormatIndentStripsLeadingIndentFromTopLevelStatement(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "  const a = 1;\n",
    "const a = 1;\n",
  )
}
