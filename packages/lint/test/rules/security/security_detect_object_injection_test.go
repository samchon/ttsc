package linthost

import "testing"

// TestSecurityDetectObjectInjection verifies security rule: dynamic bracket access is reported.
//
// Bracket notation with a variable key can hide prototype or object-injection
// sinks that dot notation would make explicit.
//
// 1. Read with a string-literal bracket key.
// 2. Read with an identifier bracket key.
// 3. Assert only the identifier access is reported.
//
// @evidence contracts/testing.md#behavioral-verification The object-injection rule reports object[key] while allowing object with a string-literal bracket key.
// @evidence contracts/testing.md#independent-expectations The independently annotated key is unknown at analysis time; the literal safe member is the adjacent policy control.
// @evidence contracts/testing.md#distinguishing-cases Same bracket-access receiver with literal versus identifier keys distinguishes dynamic injection from all computed syntax.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectObjectInjection(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-object-injection.ts", `
object["safe"];
// expect: security/detect-object-injection error
object[key];
`)
}
