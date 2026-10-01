package linthost

import "testing"

// TestJsxA11yLangRejectsEmptyLang verifies literal language tags are validated.
//
// Registry-backed parsing must reject an empty value before language matching.
//
// 1. Parse an html element with an empty lang string.
// 2. Enable only `jsx-a11y/lang`.
// 3. Assert the empty literal reports a diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify empty html language is invalid; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations en-US is a registered BCP 47 language-region tag. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases An empty language tag reports; en-US is clean. The invalid-tag host owns broader registry and syntax distinctions.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yLangRejectsEmptyLang owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yLangRejectsEmptyLang(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="" />;`, "lang")
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", "declare const props: object; const Component = () => <html lang=\"en-US\" />;")
}
