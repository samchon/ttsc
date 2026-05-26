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
func TestSecurityDetectObjectInjection(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-object-injection.ts", `
object["safe"];
// expect: security/detect-object-injection error
object[key];
`)
}
