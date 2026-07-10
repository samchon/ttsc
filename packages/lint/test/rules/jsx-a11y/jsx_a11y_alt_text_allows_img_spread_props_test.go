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
func TestJsxA11yAltTextAllowsImgSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/alt-text", `declare const props: object; const Component = () => <img {...props} />;`)
}
