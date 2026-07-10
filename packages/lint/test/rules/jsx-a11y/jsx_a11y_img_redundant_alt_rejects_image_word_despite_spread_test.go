package linthost

import "testing"

// TestJsxA11yImgRedundantAltRejectsImageWordDespiteSpread verifies spreads do
// not suppress explicit redundant alt text.
//
// img-redundant-alt judges an explicitly written alt value, so a sibling
// spread changes nothing about the violation. This pins the presence-
// predicated side of the spread handling: only absence-predicated reports go
// quiet, and the attribute walk must not panic on the JsxSpreadAttribute
// member.
//
// 1. Parse an img with a redundant alt plus a spread.
// 2. Enable only `jsx-a11y/img-redundant-alt`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yImgRedundantAltRejectsImageWordDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/img-redundant-alt", `declare const props: object; const Component = () => <img alt="photo of me" {...props} />;`, "redundant")
}
