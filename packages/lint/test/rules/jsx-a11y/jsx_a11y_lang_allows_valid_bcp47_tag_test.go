package linthost

import "testing"

// TestJsxA11yLangAllowsValidBcp47Tag verifies registered language tags are accepted.
//
// BCP 47 permits regional and script subtags. Registry-backed validation must
// preserve these standard forms on html and ignore other JSX elements.
//
// 1. Parse html elements with registered tags and a non-html invalid tag.
// 2. Enable only `jsx-a11y/lang`.
// 3. Assert valid html tags and the out-of-scope element report no diagnostic.
func TestJsxA11yLangAllowsValidBcp47Tag(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", `const Component = () => <html lang="en-US" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", `const Component = () => <html lang="zh-Hant-HK" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", `const Component = () => <div lang="foo" />;`)
}
