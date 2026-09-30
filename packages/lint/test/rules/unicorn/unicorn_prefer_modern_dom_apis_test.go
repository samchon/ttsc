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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies insertBefore performs legacy sibling insertion; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-modern-dom-apis annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; before performs the corresponding modern sibling insertion. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferModernDomApis is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferModernDomApis(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-modern-dom-apis.ts", "declare const parent: Element;\ndeclare const ref: Element;\ndeclare const node: Element;\n// expect: unicorn/prefer-modern-dom-apis error\nparent.insertBefore(node, ref);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-modern-dom-apis", "declare const ref: Element; declare const node: Element; ref.before(node);\n")
}
