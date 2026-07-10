package linthost

import "testing"

// TestJsxA11yIframeHasTitleAllowsSpreadProps verifies spread props satisfy iframe-has-title.
//
// The title may come through the `{...props}` spread, so the rule must not
// report while the prop set is unknown — `@ttsc/lint` findings are
// build-breaking compiler errors. Also pins the panic regression in jsxAttrs
// on JsxSpreadAttribute members.
//
// 1. Parse an iframe whose only attribute is a spread.
// 2. Enable only `jsx-a11y/iframe-has-title`.
// 3. Assert no diagnostic is reported.
func TestJsxA11yIframeHasTitleAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/iframe-has-title", `declare const props: object; const Component = () => <iframe {...props} />;`)
}
