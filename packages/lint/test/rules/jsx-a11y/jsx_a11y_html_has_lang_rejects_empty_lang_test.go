package linthost

import "testing"

// TestJsxA11yHtmlHasLangRejectsEmptyLang verifies an explicit lang has content.
//
// Presence alone is insufficient for screen readers to select a language, and
// the upstream html-has-lang rule rejects empty values.
//
// 1. Parse empty strings and statically falsy lang values, including a spread.
// 2. Enable only `jsx-a11y/html-has-lang`.
// 3. Assert every explicitly falsy attribute is reported.
func TestJsxA11yHtmlHasLangRejectsEmptyLang(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang="" />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang="   " />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={false} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={0} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={null} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={undefined} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `declare const props: object; const Component = () => <html {...props} lang="" />;`, "non-empty")
}
