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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify empty, whitespace and static falsy lang values are rejected even after a spread; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A nonempty language string supplies actual content; the existing seven invalid values remain checked. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Empty, whitespace, false, zero, null and undefined lang values report, including an explicit empty value after a spread; en is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yHtmlHasLangRejectsEmptyLang owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yHtmlHasLangRejectsEmptyLang(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang="" />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang="   " />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={false} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={0} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={null} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html lang={undefined} />;`, "non-empty")
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `declare const props: object; const Component = () => <html {...props} lang="" />;`, "non-empty")
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", "declare const props: object; const Component = () => <html lang=\"en\" />;")
}
