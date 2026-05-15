package main

import "testing"

// TestFixNoUselessEscapeSkipsTaggedTemplate verifies the round-2
// tagged-template bailout for `no-useless-escape`.
//
// Tag functions like `String.raw`, `dedent`, `gql`, `css` read the raw
// bytes of the template payload, so a backslash that looks redundant to
// the JS lexer is meaningful at the tag boundary. ESLint canonical skips
// tagged templates entirely. Pre-repair the rule both fired and
// autofixed, silently changing the tag's input.
//
// 1. Parse a tagged template literal with a backslash that would
//    otherwise be flagged.
// 2. Run the rule under the engine and confirm zero findings.
// 3. Source stays byte-identical.
func TestFixNoUselessEscapeSkipsTaggedTemplate(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-useless-escape",
    "const html = String.raw`<a href=\"\\#fragment\">link</a>`;\nJSON.stringify(html);\n",
  )
}
