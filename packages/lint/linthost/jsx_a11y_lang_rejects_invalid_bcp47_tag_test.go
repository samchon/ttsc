package linthost

import "testing"

// TestJsxA11yLangRejectsInvalidBcp47Tag verifies registry-backed validation.
//
// Non-empty syntax is insufficient: whitespace, unknown language subtags, and
// statically undefined or non-string values cannot identify a language.
//
// 1. Parse padded, unregistered, malformed, undefined, and shorthand values.
// 2. Enable only `jsx-a11y/lang`.
// 3. Assert every statically invalid attribute reports a diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify padded, unregistered, undefined and shorthand html language values are invalid; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The authored zh-Hant-HK language/script/region sequence is registered; the controls separately reject padding, unknown language/region identifiers and attributes without a string tag. These are distinct static validation failures, not five malformed BCP 47 strings, and the expectations are literal policy inputs rather than sampled output.
// @evidence contracts/testing.md#distinguishing-cases Padded en, unknown foo, zz-LL, undefined and boolean shorthand report; the language/script/region tag zh-Hant-HK is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yLangRejectsInvalidBcp47Tag owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yLangRejectsInvalidBcp47Tag(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang=" en " />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="foo" />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="zz-LL" />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang={undefined} />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang />;`, "lang")
  assertJsxA11yRuleSkips(t, "jsx-a11y/lang", "declare const props: object; const Component = () => <html lang=\"zh-Hant-HK\" />;")
}
