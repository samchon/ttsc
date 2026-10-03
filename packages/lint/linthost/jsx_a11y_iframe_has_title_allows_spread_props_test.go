package linthost

import "testing"

// TestJsxA11yIframeHasTitleAllowsSpreadProps verifies iframe-has-title
// abstains when an unknown spread may supply title.
//
// The title may come through the `{...props}` spread, so the rule must not
// report while the prop set is unknown — `@ttsc/lint` findings are
// build-breaking compiler errors. Also pins the panic regression in jsxAttrs
// on JsxSpreadAttribute members.
//
// 1. Parse an iframe whose only attribute is a spread.
// 2. Enable only `jsx-a11y/iframe-has-title`.
// 3. Assert no diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify iframe with unknown props remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations The conservative missing-title policy leaves an unknown spread that may supply a title alone. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases IframeHasTitleRequiresTitle owns known missing attributes.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yIframeHasTitleAllowsSpreadProps owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yIframeHasTitleAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/iframe-has-title", `declare const props: object; const Component = () => <iframe {...props} />;`)
}
