package linthost

import "testing"

// TestSecurityDetectChildProcessInlineRequireExecReportsOnce verifies security rule: inline exec reports once.
//
// The AST visits the inner `require("child_process")` call and the outer
// `exec(command)` call separately. This pins the de-duplication path so the
// inline form keeps the specific non-literal exec diagnostic without also
// reporting the nested require.
//
// 1. Call `exec` through an inline `require("child_process")` expression.
// 2. Pass a non-literal command argument.
// 3. Assert exactly one `security/detect-child-process` finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification The detect-child-process rule emits one finding for require(child_process).exec(command), without a duplicate from the inner require visit.
// @evidence contracts/testing.md#independent-expectations One authored expectation names the dynamic exec sink; the nested literal module load is not a second dynamic command. The expected cardinality is not generated from findings.
// @evidence contracts/testing.md#distinguishing-cases Pins the inline imported-call nesting and exact single report; TestSecurityDetectChildProcess separately covers imported namespace literal and dynamic command arguments.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectChildProcessInlineRequireExecReportsOnce(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-child-process-inline-require-exec.ts", `
// expect: security/detect-child-process error
require("child_process").exec(command);
`)
}
