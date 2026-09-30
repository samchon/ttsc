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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies appendChild uses the legacy single-node insertion API; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-dom-node-append annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; append inserts the same node using the supported API. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferDomNodeAppend is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferDomNodeAppend(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-dom-node-append.ts", "declare const parent: Element;\ndeclare const child: Element;\n// expect: unicorn/prefer-dom-node-append error\nparent.appendChild(child);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-dom-node-append", "declare const parent: Element; declare const child: Element; parent.append(child);\n")
}
