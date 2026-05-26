package linthost

import "testing"

// TestJsxA11yLangRejectsEmptyLang verifies literal language tags are validated.
//
// The native check is intentionally conservative but should still reject an
// empty language tag when the value is statically known.
//
// 1. Parse an html element with an empty lang string.
// 2. Enable only `jsx-a11y/lang`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yLangRejectsEmptyLang(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="" />;`, "lang")
}
