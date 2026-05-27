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
func TestRuleCorpusUnicornPreferNodeProtocol(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-node-protocol.ts", "// expect: unicorn/prefer-node-protocol error\nimport * as fs from \"fs\";\nvoid fs;\n")
}
