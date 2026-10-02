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
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must offer no edit for template head/tail trailing spaces around the x substitution.
// @evidence contracts/testing.md#independent-expectations The literal template whitespace contributes to its string value and must remain independently of formatting preferences.
// @evidence contracts/testing.md#distinguishing-cases One interpolated head/tail negative complements no-substitution/nested-template guards and real-source trimming positives.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespacePreservesTrailingSpaceAcrossTemplateSubstitution is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and observes zero findings in the same process without a consumer install, native product build or product host.
func TestFormatWhitespacePreservesTrailingSpaceAcrossTemplateSubstitution(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a \n${x} \nb`;\n",
  )
}
