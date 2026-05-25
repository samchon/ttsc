package linthost

import "testing"

// TestSecurityDetectUnsafeRegex verifies security rule: nested quantified regex is reported.
//
// The implementation intentionally uses a high-confidence heuristic for classic
// catastrophic backtracking shapes rather than a broad regex parser.
//
// 1. Parse a simple regular expression literal.
// 2. Parse a nested quantified regular expression literal.
// 3. Assert only the nested quantified pattern is reported.
func TestSecurityDetectUnsafeRegex(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-unsafe-regex.ts", `
/^d+1337d+$/;
// expect: security/detect-unsafe-regex error
/(x+x+)+y/;
`)
}
