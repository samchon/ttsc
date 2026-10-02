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
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must offer no collapse of two blank lines inside a multiline template.
// @evidence contracts/testing.md#independent-expectations The independent a/newlines/b literal fixes its string value, making the template blank run meaningful payload.
// @evidence contracts/testing.md#distinguishing-cases The protected blank-run negative contrasts with the changed three-blank-line source collapse and template space preservation.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceKeepsBlankLineInsideTemplate is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and observes zero findings in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceKeepsBlankLineInsideTemplate(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a\n\n\nb`;\n",
  )
}
