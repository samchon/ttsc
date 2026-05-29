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
func TestFormatWhitespacePreservesNestedTemplateContent(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const t = `a${`x \ny`}b`;\n",
  )
}
