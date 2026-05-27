package linthost

import "testing"

// TestRuleCorpusUnicornPreferDomNodeTextContent verifies
// unicorn/prefer-dom-node-text-content reports `el.innerText`.
//
// Identifier-text-driven on the property name; the fixture pins the
// property-access visit branch that flags the legacy `innerText` read in
// favor of `Node#textContent`.
//
// 1. Enable unicorn/prefer-dom-node-text-content via an expect annotation.
// 2. Read `el.innerText` from a declared element.
// 3. Assert the property access is reported.
func TestRuleCorpusUnicornPreferDomNodeTextContent(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-dom-node-text-content.ts", "declare const el: HTMLElement;\n// expect: unicorn/prefer-dom-node-text-content error\nel.innerText;\n")
}
