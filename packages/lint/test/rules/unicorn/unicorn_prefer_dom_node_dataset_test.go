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
func TestRuleCorpusUnicornPreferDomNodeDataset(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-dom-node-dataset.ts", "declare const el: Element;\n// expect: unicorn/prefer-dom-node-dataset error\nel.getAttribute(\"data-foo\");\n")
}
