package linthost

import "testing"

// TestRuleCorpusUnicornPreferModernDomApis verifies
// unicorn/prefer-modern-dom-apis reports `parent.insertBefore(node, ref)`.
//
// Identifier-text-driven on the legacy mutation method name; the fixture
// pins the property-access-call branch that flags the legacy DOM mutation
// shapes in favor of `before` / `after` / `replaceWith`.
//
// 1. Enable unicorn/prefer-modern-dom-apis via an expect annotation.
// 2. Call `parent.insertBefore(node, ref)` on three declared elements.
// 3. Assert the call site is reported.
func TestRuleCorpusUnicornPreferModernDomApis(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-modern-dom-apis.ts", "declare const parent: Element;\ndeclare const ref: Element;\ndeclare const node: Element;\n// expect: unicorn/prefer-modern-dom-apis error\nparent.insertBefore(node, ref);\n")
}
