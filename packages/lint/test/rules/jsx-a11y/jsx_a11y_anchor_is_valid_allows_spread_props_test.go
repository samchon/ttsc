package linthost

import "testing"

// TestJsxA11yAnchorIsValidAllowsSpreadProps verifies spread props satisfy anchor-is-valid.
//
// The href may come through the `{...props}` spread, so the missing-href
// branch must not report — the upstream eslint-plugin-jsx-a11y rule lists
// `<a {...props} />` as valid for the same reason. Also pins the panic
// regression in jsxAttrs on JsxSpreadAttribute members.
//
// 1. Parse an anchor whose only attribute is a spread.
// 2. Enable only `jsx-a11y/anchor-is-valid`.
// 3. Assert no diagnostic is reported.
func TestJsxA11yAnchorIsValidAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", `declare const props: object; const Component = () => <a {...props}>documentation</a>;`)
}
