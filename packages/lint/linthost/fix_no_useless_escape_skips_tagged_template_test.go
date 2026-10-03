package linthost

import "testing"

// TestFixNoUselessEscapeSkipsTaggedTemplate verifies the tagged-template
// bailout for `no-useless-escape`.
//
// Tag functions like `String.raw`, `dedent`, `gql`, `css` read the raw
// bytes of the template payload, so a backslash that looks redundant to
// the JS lexer is meaningful at the tag boundary. ESLint skips the tag's
// own template elements, while literals nested in substitutions remain
// checked. This fixture pins silence for the tag's own raw payload.
//
//  1. Parse a tagged template literal with a backslash that would
//     otherwise be flagged.
//  2. Run the rule under the engine and confirm zero findings.
//  3. Source stays byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification no-useless-escape leaves the backslash before # inside String.raw untouched by emitting no finding.
// @evidence contracts/testing.md#independent-expectations The independently authored tag consumes raw template bytes, so the zero-finding oracle preserves its meaningful backslash.
// @evidence contracts/testing.md#distinguishing-cases A tagged template differs from ordinary cooked string escapes fixed by TestFixNoUselessEscapeDropsBackslash.
// @evidence contracts/testing.md#execution-ownership TestFixNoUselessEscapeSkipsTaggedTemplate calls assertRuleSkipsSource with the literal String.raw fixture in the Go process.
func TestFixNoUselessEscapeSkipsTaggedTemplate(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-useless-escape",
    "const html = String.raw`<a href=\"\\#fragment\">link</a>`;\nJSON.stringify(html);\n",
  )
}
