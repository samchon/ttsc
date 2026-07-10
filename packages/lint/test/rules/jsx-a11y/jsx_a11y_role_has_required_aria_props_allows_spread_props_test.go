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
func TestJsxA11yRoleHasRequiredAriaPropsAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-has-required-aria-props", `declare const props: object; const Component = () => <span role="checkbox" {...props} />;`)
}
