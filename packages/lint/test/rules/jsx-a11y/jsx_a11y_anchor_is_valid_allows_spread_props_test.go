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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify anchor with only unknown spread remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations A spread may provide href; absence cannot be proven statically. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Explicit invalid hash despite a spread is checked by its separate reported counterpart.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAnchorIsValidAllowsSpreadProps owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAnchorIsValidAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", `declare const props: object; const Component = () => <a {...props}>documentation</a>;`)
}
