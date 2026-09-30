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
//
// @evidence contracts/testing.md#behavioral-verification The detect-non-literal-require rule reports require(moduleName) while accepting the literal node:fs specifier.
// @evidence contracts/testing.md#independent-expectations The authored annotation identifies non-literal module selection as the policy violation; no installed Node module resolution is needed to decide this AST policy.
// @evidence contracts/testing.md#distinguishing-cases Same require callee with literal versus identifier input detects both blanket reporting and missed dynamic loads.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNonLiteralRequire(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-non-literal-require.ts", `
require("node:fs");
// expect: security/detect-non-literal-require error
require(moduleName);
`)
}
