package linthost

import (
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEscapeFlagsRegexCharacterClass verifies no-useless-escape inside `[...]`.
//
// Pins the issue-120 regression: escapes that are useless inside a regex
// character class (e.g. `[\.]`, `[\$]`, `[\(]`) must be flagged, matching
// ESLint core. The class context only widens the meaningful escape set for
// `\\`, `]`, `-`, the backspace `\b`, and the standard shorthand classes —
// every other regex meta-char loses its special meaning once it is inside a
// `[...]`, so the backslash is noise.
//
// 1. Parse regex literals with redundant char-class escapes alongside legitimate ones.
// 2. Enable only `no-useless-escape`.
// 3. Assert each useless-inside-class escape is reported and the legitimate escapes stay silent.
func TestNoUselessEscapeFlagsRegexCharacterClass(t *testing.T) {
	source := `const dotInClass = /[\.]/;
const dollarInClass = /[\$]/;
const parenInClass = /[\(]/;
const literalDot = /\./;
const dashInClass = /[a\-z]/;
const closeBracketInClass = /[\]]/;
const wordInClass = /[\w]/;
`
	file := parseTS(t, source)
	findings := NewEngine(RuleConfig{
		"no-useless-escape": SeverityError,
	}).Run([]*shimast.SourceFile{file}, nil)
	actual := normalizeRuleFindings(file, findings)
	expected := []ruleExpectation{
		{Rule: "no-useless-escape", Severity: SeverityError, Line: 1},
		{Rule: "no-useless-escape", Severity: SeverityError, Line: 2},
		{Rule: "no-useless-escape", Severity: SeverityError, Line: 3},
	}
	if len(actual) != len(expected) {
		t.Fatalf("want %v, got %v", expected, actual)
	}
	for i := range expected {
		if actual[i] != expected[i] {
			t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
		}
	}
}
