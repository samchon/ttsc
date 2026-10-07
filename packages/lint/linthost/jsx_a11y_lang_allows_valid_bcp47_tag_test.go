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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify registered en-US and zh-Hant-HK plus out-of-scope div remain accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations BCP 47 permits registered language/region/script combinations; this html-scoped rule does not govern div language. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Script/region lengths and tag scope contrast with empty and invalid-tag rejection cases.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yLangAllowsValidBcp47Tag owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yLangAllowsValidBcp47Tag(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", `const Component = () => <html lang="en-US" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", `const Component = () => <html lang="zh-Hant-HK" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", `const Component = () => <div lang="foo" />;`)
}
