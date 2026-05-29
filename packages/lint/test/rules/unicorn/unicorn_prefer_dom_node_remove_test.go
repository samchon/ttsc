package linthost

import "testing"

// TestRuleCorpusUnicornPreferDomNodeRemove verifies
// unicorn/prefer-dom-node-remove reports `parent.removeChild(child)`.
//
// Identifier-text-driven on the method name with a one-argument gate; the
// fixture pins the single-argument property-access-call branch that flags
// the legacy detach idiom in favor of `ChildNode#remove()`.
//
// 1. Enable unicorn/prefer-dom-node-remove via an expect annotation.
// 2. Call `parent.removeChild(child)` on two declared elements.
// 3. Assert the call site is reported.
func TestRuleCorpusUnicornPreferDomNodeRemove(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-dom-node-remove.ts", "declare const parent: Element;\ndeclare const child: Element;\n// expect: unicorn/prefer-dom-node-remove error\nparent.removeChild(child);\n")
}
