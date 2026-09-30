package linthost

import "testing"

// TestJsxA11yRoleHasRequiredAriaPropsAllowsSpreadProps verifies spread props
// satisfy role-has-required-aria-props.
//
// The required aria-checked may come through the `{...props}` spread, so the
// rule must not report while the prop set is unknown — `@ttsc/lint` findings
// are build-breaking compiler errors. Also pins the panic regression in
// jsxAttrs on JsxSpreadAttribute members.
//
// 1. Parse a span with an explicit checkbox role plus a spread.
// 2. Enable only `jsx-a11y/role-has-required-aria-props`.
// 3. Assert no diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify explicit checkbox role with unknown props remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations Unknown spread props can supply the role-required state; absence is not proven. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases RequiresCheckboxChecked owns known absent state without a spread.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRoleHasRequiredAriaPropsAllowsSpreadProps owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRoleHasRequiredAriaPropsAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-has-required-aria-props", `declare const props: object; const Component = () => <span role="checkbox" {...props} />;`)
}
