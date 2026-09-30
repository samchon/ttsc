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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify html omits lang; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations An explicit nonempty language supplies the required declaration. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Missing html lang reports; explicit en is clean. The empty-lang host owns invalid present values.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yHtmlHasLangRequiresLang owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yHtmlHasLangRequiresLang(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/html-has-lang", `const Component = () => <html />;`, "lang")
  assertJsxA11yRuleSkips(t, "jsx-a11y/html-has-lang", "declare const props: object; const Component = () => <html lang=\"en\" />;")
}
