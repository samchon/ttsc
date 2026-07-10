package linthost

import "testing"

// TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread verifies spreads
// do not suppress explicit roles on unsupported elements.
//
// aria-unsupported-elements judges explicitly written role/aria-* attributes
// on meta/html/script/style, so a sibling spread changes nothing about the
// violation. Pins the presence-predicated side of the spread handling and the
// no-panic attribute walk.
//
// 1. Parse a meta element with an explicit role plus a spread.
// 2. Enable only `jsx-a11y/aria-unsupported-elements`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-unsupported-elements", `declare const props: object; const Component = () => <meta charSet="utf-8" role="none" {...props} />;`, "ARIA roles")
}
