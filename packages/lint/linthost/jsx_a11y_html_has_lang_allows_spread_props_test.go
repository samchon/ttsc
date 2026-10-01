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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify html with only unknown props remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations ttsc deliberately cannot prove lang absence across an unknown spread, unlike the stricter upstream policy. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases RequiresLang owns known absence and RejectsEmptyLang owns explicit invalid values; spread acceptance is not claimed as upstream equivalence.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yHtmlHasLangAllowsSpreadProps owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yHtmlHasLangAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", `declare const props: object; const Component = () => <html {...props} />;`)
}
