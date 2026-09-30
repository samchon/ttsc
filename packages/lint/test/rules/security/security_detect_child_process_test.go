package linthost

import "testing"

// TestSecurityDetectChildProcess verifies security rule: child_process exec rejects dynamic commands.
//
// The high-confidence path is an imported child_process binding whose `exec` command
// argument is not statically known.
//
// 1. Import the child_process module.
// 2. Call `exec` with a variable command.
// 3. Assert `security/detect-child-process` reports the call.
//
// @evidence contracts/testing.md#behavioral-verification The detect-child-process rule distinguishes imported child.exec(command) from child.exec with a literal command.
// @evidence contracts/testing.md#independent-expectations The authored marker identifies the non-literal command as the security policy violation; literal ls is deliberately allowed by this rule. Exact line and severity are compared.
// @evidence contracts/testing.md#distinguishing-cases Imported namespace calls share the same callee and differ only in literal versus identifier input; inline require nesting is owned by TestSecurityDetectChildProcessInlineRequireExecReportsOnce.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectChildProcess(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-child-process.ts", `
import child from "child_process";
child.exec("ls");
// expect: security/detect-child-process error
child.exec(command);
`)
}
