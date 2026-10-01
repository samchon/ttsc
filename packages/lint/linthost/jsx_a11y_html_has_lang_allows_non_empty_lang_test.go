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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify en and boolean shorthand remain accepted by html-has-lang; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations This presence/content rule accepts nonempty language content and shorthand; registry validity belongs to the distinct lang rule. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases HtmlHasLangRejectsEmptyLang owns explicit falsy values, while LangRejectsInvalidBcp47Tag owns registry validity.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yHtmlHasLangAllowsNonEmptyLang owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yHtmlHasLangAllowsNonEmptyLang(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang="en" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang />;`)
}
