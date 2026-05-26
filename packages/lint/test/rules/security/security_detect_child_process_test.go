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
func TestSecurityDetectChildProcess(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-child-process.ts", `
import child from "child_process";
child.exec("ls");
// expect: security/detect-child-process error
child.exec(command);
`)
}
