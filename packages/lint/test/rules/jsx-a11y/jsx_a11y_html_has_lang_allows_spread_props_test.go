package linthost

import "testing"

// TestJsxA11yHtmlHasLangAllowsSpreadProps verifies spread props satisfy html-has-lang.
//
// The lang attribute may come through the `{...props}` spread. Upstream
// eslint-plugin-jsx-a11y still reports `<html {...props} />`, but `@ttsc/lint`
// findings are build-breaking compiler errors, so absence-predicated reports
// deliberately stay conservative when the prop set is unknown. Also pins the
// panic regression in jsxAttrs on JsxSpreadAttribute members.
//
// 1. Parse an html element whose only attribute is a spread.
// 2. Enable only `jsx-a11y/html-has-lang`.
// 3. Assert no diagnostic is reported.
func TestJsxA11yHtmlHasLangAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", `declare const props: object; const Component = () => <html {...props} />;`)
}
