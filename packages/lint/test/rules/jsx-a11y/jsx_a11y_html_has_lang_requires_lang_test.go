package linthost

import "testing"

// TestJsxA11yHtmlHasLangRequiresLang verifies html elements declare language.
//
// The rule is a simple intrinsic tag check, but it needs coverage because TSX
// applications often render document shells directly.
//
// 1. Parse an html element without lang.
// 2. Enable only `jsx-a11y/html-has-lang`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yHtmlHasLangRequiresLang(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html />;`, "lang")
}
