package linthost

import "testing"

// TestJsxA11yAltTextAllowsImgSpreadProps verifies spread props satisfy alt-text.
//
// A `{...props}` spread makes the prop set unknown at lint time — the alt may
// well be inside it — and `@ttsc/lint` findings are build-breaking compiler
// errors, so the rule must stay quiet instead of guessing. This case also
// pins the panic regression: jsxAttrs used to crash on JsxSpreadAttribute
// members ("interface conversion: ast.nodeData is *ast.JsxSpreadAttribute,
// not *ast.JsxAttribute").
//
// 1. Parse an img whose only attribute is a spread.
// 2. Enable only `jsx-a11y/alt-text`.
// 3. Assert no diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify unknown spread props are accepted without a missing-alt or panic finding; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations The conservative ttsc missing-attribute contract permits alt to arrive through an unknown spread. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases AltTextRequiresImgAlt owns known absent attributes.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAltTextAllowsImgSpreadProps owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAltTextAllowsImgSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/alt-text", `declare const props: object; const Component = () => <img {...props} />;`)
}
