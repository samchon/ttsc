package linthost

import "testing"

// TestFormatWhitespacePreservesNestedTemplateContent verifies trailing
// spaces inside a template nested in another template's `${}` survive.
//
// A `${ `inner ` }` substitution is itself a template literal whose lines
// are string content. The AST walk records both ranges, so a trailing
// space on the inner template's line must not be trimmed. This pins that
// the range collection recurses into nested templates.
//
//  1. Parse an outer template whose interpolation holds a multi-line
//     inner template with a trailing space.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must emit no finding for a trailing space in an inner template nested in an outer substitution.
// @evidence contracts/testing.md#independent-expectations The independently authored inner x-space-newline-y bytes belong to the composed string value and cannot be trimmed.
// @evidence contracts/testing.md#distinguishing-cases Nested-template protection complements simpler template guards and real-source trimming, distinguishing recursive ranges from head-only protection.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespacePreservesNestedTemplateContent is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and observes zero findings in the same process without a consumer install, native product build or product host.
func TestFormatWhitespacePreservesNestedTemplateContent(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a${`x \ny`}b`;\n",
  )
}
