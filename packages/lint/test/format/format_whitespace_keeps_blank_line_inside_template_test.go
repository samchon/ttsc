package linthost

import "testing"

// TestFormatWhitespaceKeepsBlankLineInsideTemplate verifies a blank line
// inside a template literal is not collapsed by the blank-run rule.
//
// Blank lines inside a template are part of the string value. The
// collapse pass skips template-interior lines, so two consecutive blank
// lines inside backticks survive while the same run in real source would
// reduce to one. This pins that the collapse honors the template guard.
//
//  1. Parse a template literal containing two consecutive blank lines.
//  2. Run the rule.
//  3. Assert it emits no finding (the blank run is preserved).
func TestFormatWhitespaceKeepsBlankLineInsideTemplate(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a\n\n\nb`;\n",
  )
}
