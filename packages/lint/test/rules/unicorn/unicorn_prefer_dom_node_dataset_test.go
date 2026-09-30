package linthost

import "testing"

// TestRuleCorpusUnicornPreferDomNodeDataset verifies
// unicorn/prefer-dom-node-dataset reports `el.getAttribute("data-foo")`.
//
// The fixture pins the literal-prefix gate that isolates `data-*`
// attribute reads from arbitrary `getAttribute` usage, in favor of the
// typed `Element#dataset` accessor.
//
// 1. Enable unicorn/prefer-dom-node-dataset via an expect annotation.
// 2. Call `el.getAttribute("data-foo")` on a declared element.
// 3. Assert the call site is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies getAttribute accesses a data-* attribute; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-dom-node-dataset annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; dataset accesses the corresponding data key. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferDomNodeDataset is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferDomNodeDataset(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-dom-node-dataset.ts", "declare const el: Element;\n// expect: unicorn/prefer-dom-node-dataset error\nel.getAttribute(\"data-foo\");\n")
  assertRuleSkipsSource(t, "unicorn/prefer-dom-node-dataset", "declare const el: HTMLElement; void el.dataset.foo;\n")
}
