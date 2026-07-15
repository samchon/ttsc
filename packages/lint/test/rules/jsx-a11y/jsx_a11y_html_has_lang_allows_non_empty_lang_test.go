package linthost

import "testing"

// TestJsxA11yHtmlHasLangAllowsNonEmptyLang verifies valid content is preserved.
//
// The empty-value branch must not turn every explicit lang attribute into a
// diagnostic.
//
// 1. Parse html elements with a non-empty value and boolean shorthand.
// 2. Enable only `jsx-a11y/html-has-lang`.
// 3. Assert the valid attribute is not reported.
func TestJsxA11yHtmlHasLangAllowsNonEmptyLang(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang="en" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang />;`)
}
