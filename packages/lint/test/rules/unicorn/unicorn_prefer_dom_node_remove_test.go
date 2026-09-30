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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies parent.removeChild removes a node through its parent; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-dom-node-remove annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the child removes itself directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferDomNodeRemove is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferDomNodeRemove(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-dom-node-remove.ts", "declare const parent: Element;\ndeclare const child: Element;\n// expect: unicorn/prefer-dom-node-remove error\nparent.removeChild(child);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-dom-node-remove", "declare const child: Element; child.remove();\n")
}
