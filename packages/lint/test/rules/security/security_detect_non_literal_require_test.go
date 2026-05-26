package linthost

import "testing"

// TestSecurityDetectNonLiteralRequire verifies security rule: require specifiers stay literal.
//
// Node resolves `require` strings through filesystem and package lookup rules, so
// dynamic specifiers are treated as a code-loading risk.
//
// 1. Require a literal module.
// 2. Require an identifier module name.
// 3. Assert only the identifier call is reported.
func TestSecurityDetectNonLiteralRequire(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-non-literal-require.ts", `
require("node:fs");
// expect: security/detect-non-literal-require error
require(moduleName);
`)
}
