package linthost

import "testing"

// TestJsxA11yImgRedundantAltRejectsImageWord verifies redundant image wording is rejected.
//
// Screen readers already announce image roles, so this rule inspects literal alt
// text for repeated words such as image, photo, or picture.
//
// 1. Parse an img whose alt text starts with "image".
// 2. Enable only `jsx-a11y/img-redundant-alt`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yImgRedundantAltRejectsImageWord(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/img-redundant-alt", `const Component = () => <img alt="image of profile" />;`, "redundant")
}
