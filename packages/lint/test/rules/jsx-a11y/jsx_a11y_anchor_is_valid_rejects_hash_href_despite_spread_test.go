package linthost

import "testing"

// TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread verifies spreads do not
// suppress explicit href violations.
//
// The conservative spread handling only applies to absence-predicated
// reports; an explicitly written `href="#"` is a violation on its own, and a
// sibling spread must not turn the rule off wholesale. This is the negative
// twin of the allows-spread-props case.
//
// 1. Parse an anchor with an explicit hash href plus a spread.
// 2. Enable only `jsx-a11y/anchor-is-valid`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-is-valid", `declare const props: object; const Component = () => <a href="#" {...props}>documentation</a>;`, "valid navigation target")
}
