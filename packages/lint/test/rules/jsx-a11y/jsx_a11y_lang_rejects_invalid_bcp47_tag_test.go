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
func TestJsxA11yLangRejectsInvalidBcp47Tag(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang=" en " />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="foo" />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang="zz-LL" />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang={undefined} />;`, "lang")
  assertJsxA11yRuleFinds(t, "jsx-a11y/lang", `const Component = () => <html lang />;`, "lang")
}
