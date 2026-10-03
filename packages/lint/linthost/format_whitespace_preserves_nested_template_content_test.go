package linthost

import "testing"

// TestFormatWhitespacePreservesNestedTemplateContent verifies trailing
// spaces inside a template nested in another template's `${}` survive.
//
// The inner template's trailing space is string content. This source
// requires preserving that payload; the enclosing full template range
// already covers it, so absence of a finding does not independently
// prove that the range collection visited the inner template.
//
//  1. Parse an outer template whose interpolation holds a multi-line
//     inner template with a trailing space.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must emit no finding for a trailing space in an inner template nested in an outer substitution.
// @evidence contracts/testing.md#independent-expectations The independently authored inner x-space-newline-y bytes belong to the composed string value and cannot be trimmed.
// @evidence contracts/testing.md#distinguishing-cases Nested-template payload protection complements simple templates and real-source trimming. This negative distinguishes protection of the nested payload from head-only protection, but does not distinguish recursive inner-range collection from protection by the enclosing full range.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespacePreservesNestedTemplateContent is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and observes zero findings in the same process without a consumer install, native product build or product host.
func TestFormatWhitespacePreservesNestedTemplateContent(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a${`x \ny`}b`;\n",
  )
}
