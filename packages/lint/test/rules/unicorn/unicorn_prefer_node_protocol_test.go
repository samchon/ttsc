package linthost

import "testing"

// TestRuleCorpusUnicornPreferNodeProtocol verifies unicorn/prefer-node-protocol
// reports a bare Node built-in import that omits the `node:` prefix.
//
// The rule's primary branch matches a `StringLiteral` module specifier whose
// text is one of the Node built-in names; the static-import case is the most
// idiomatic shape and the one most likely to regress, so a bare `import * as
// fs from "fs"` pins the canonical positive case.
//
// 1. Enable unicorn/prefer-node-protocol via an expect annotation.
// 2. Import the `fs` built-in without the `node:` prefix.
// 3. Assert the module specifier literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a builtin import omits the node: protocol; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-node-protocol annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same builtin import explicitly uses node:. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferNodeProtocol is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferNodeProtocol(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-node-protocol.ts", "// expect: unicorn/prefer-node-protocol error\nimport * as fs from \"fs\";\nvoid fs;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-node-protocol", "import * as fs from \"node:fs\"; void fs;\n")
}
