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
//
// @evidence contracts/testing.md#behavioral-verification The detect-eval-with-expression rule reports eval(userInput) while permitting the literal eval call under this narrower security policy.
// @evidence contracts/testing.md#independent-expectations The fixture annotation follows the dynamic input policy, independently of the evaluator scanner; the broader no-eval policy is not enabled here.
// @evidence contracts/testing.md#distinguishing-cases Literal and identifier arguments share eval as the callee, so unconditional eval reporting and missed dynamic input both fail.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectEvalWithExpression(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-eval-with-expression.ts", `
eval("alert()");
// expect: security/detect-eval-with-expression error
eval(userInput);
`)
}
