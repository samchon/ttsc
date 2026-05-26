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
func TestSecurityDetectChildProcessInlineRequireExecReportsOnce(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-child-process-inline-require-exec.ts", `
// expect: security/detect-child-process error
require("child_process").exec(command);
`)
}
