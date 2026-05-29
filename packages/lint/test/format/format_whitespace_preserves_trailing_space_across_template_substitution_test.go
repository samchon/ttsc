package linthost

import "testing"

// TestFormatWhitespacePreservesTrailingSpaceAcrossTemplateSubstitution
// verifies trailing spaces survive in every span of a multi-part
// template (head, between, and tail of a `${}` interpolation).
//
// A TemplateExpression's range covers the head, every interpolation, and
// the tail, so a trailing space on any interior line is string content
// and must not be trimmed. This pins that the template-range guard
// protects the whole multi-part literal, not just a head-only span.
//
//  1. Parse a multi-line template with `${x}` and trailing spaces on its
//     interior lines.
//  2. Run the rule.
//  3. Assert it emits no finding (template content is untouched).
func TestFormatWhitespacePreservesTrailingSpaceAcrossTemplateSubstitution(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a \n${x} \nb`;\n",
  )
}
