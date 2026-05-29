package linthost

import "testing"

// TestRuleCorpusUnicornPreferDomNodeAppend verifies
// unicorn/prefer-dom-node-append reports a call to `parent.appendChild(child)`.
//
// Identifier-text-driven on the method name; the receiver is not
// type-checked. The fixture pins the property-access-call branch that
// rejects the legacy single-child DOM API in favor of `Node#append`.
//
// 1. Enable unicorn/prefer-dom-node-append via an expect annotation.
// 2. Call `parent.appendChild(child)` on two declared elements.
// 3. Assert the call site is reported.
func TestRuleCorpusUnicornPreferDomNodeAppend(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-dom-node-append.ts", "declare const parent: Element;\ndeclare const child: Element;\n// expect: unicorn/prefer-dom-node-append error\nparent.appendChild(child);\n")
}
