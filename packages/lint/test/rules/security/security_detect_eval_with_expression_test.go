package linthost

import "testing"

// TestSecurityDetectEvalWithExpression verifies security rule: eval rejects dynamic input.
//
// This complements `no-eval`: literal eval calls are handled by policy, while this
// security rule specifically catches attacker-controlled expression input.
//
// 1. Call `eval` with a string literal.
// 2. Call `eval` with an identifier.
// 3. Assert only the identifier call is reported.
func TestSecurityDetectEvalWithExpression(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-eval-with-expression.ts", `
eval("alert()");
// expect: security/detect-eval-with-expression error
eval(userInput);
`)
}
