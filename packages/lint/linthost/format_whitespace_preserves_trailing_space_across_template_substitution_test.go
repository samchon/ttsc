package linthost

import "testing"

// TestFormatWhitespacePreservesTrailingSpaceAcrossTemplateSubstitution
// verifies trailing spaces survive in the head and tail around one
// `${x}` substitution.
//
// Both authored spaces are template string payload. Preserving the
// head's space and the tail's space after `${x}` distinguishes protection
// of this complete literal from protection of its head alone. This
// input does not contain a separate middle span or multiline expression.
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
