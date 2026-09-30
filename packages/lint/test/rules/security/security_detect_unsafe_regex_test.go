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
//
// @evidence contracts/testing.md#behavioral-verification The unsafe-regex rule reports the nested repeated (x+x+)+y literal but not the simple anchored pattern.
// @evidence contracts/testing.md#independent-expectations The independently annotated nested repetition is the supported high-confidence catastrophic-backtracking shape; the assertion does not prove a complete regex complexity analysis.
// @evidence contracts/testing.md#distinguishing-cases Pairs simple repetition with nested repetition and preserves the deliberate conservative heuristic boundary.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectUnsafeRegex(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-unsafe-regex.ts", `
/^d+1337d+$/;
// expect: security/detect-unsafe-regex error
/(x+x+)+y/;
`)
}
