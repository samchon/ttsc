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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies innerText uses layout-sensitive text access; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-dom-node-text-content annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; textContent accesses text without the innerText operation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferDomNodeTextContent is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferDomNodeTextContent(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-dom-node-text-content.ts", "declare const el: HTMLElement;\n// expect: unicorn/prefer-dom-node-text-content error\nel.innerText;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-dom-node-text-content", "declare const el: HTMLElement; void el.textContent;\n")
}
