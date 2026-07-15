package linthost

import "testing"

// TestJsxA11yLangRejectsEmptyLang verifies literal language tags are validated.
//
// Registry-backed parsing must reject an empty value before language matching.
//
// 1. Parse an html element with an empty lang string.
// 2. Enable only `jsx-a11y/lang`.
// 3. Assert the empty literal reports a diagnostic.
func TestJsxA11yLangRejectsEmptyLang(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="" />;`, "lang")
}
