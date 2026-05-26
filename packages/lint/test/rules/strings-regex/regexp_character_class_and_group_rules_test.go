package linthost

import (
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRegexpCharacterClassAndGroupRules verifies source-only regexp class and group checks.
//
// Covers the high-confidence regexp-family rules that look only at character
// classes, empty alternatives, and empty groups. Range-like classes are kept
// conservative so the duplicate-character check does not flag ambiguous ranges.
//
// 1. Parse literals with duplicate class members, reducible classes, and empty groups.
// 2. Enable the matching `regexp/*` rules.
// 3. Assert each rule reports exactly once on the expected literal line.
func TestRegexpCharacterClassAndGroupRules(t *testing.T) {
	source := `const duplicate = /[aba]/;
const single = /[x]/;
const digit = /[0-9]/;
const word = /[A-Za-z0-9_]/;
const emptyAlt = /a||b/;
const emptyCap = /()/;
const emptyGroup = /(?:)/;
const emptyLook = /(?=)/;
`
	file := parseTS(t, source)
	findings := NewEngine(RuleConfig{
		"regexp/no-dupe-characters-character-class": SeverityError,
		"regexp/no-useless-character-class":         SeverityError,
		"regexp/prefer-d":                           SeverityError,
		"regexp/prefer-w":                           SeverityError,
		"regexp/no-empty-alternative":               SeverityError,
		"regexp/no-empty-capturing-group":           SeverityError,
		"regexp/no-empty-group":                     SeverityError,
		"regexp/no-empty-lookarounds-assertion":     SeverityError,
	}).Run([]*shimast.SourceFile{file}, nil)
	actual := normalizeRuleFindings(file, findings)
	expected := []ruleExpectation{
		{Rule: "regexp/no-dupe-characters-character-class", Severity: SeverityError, Line: 1},
		{Rule: "regexp/no-useless-character-class", Severity: SeverityError, Line: 2},
		{Rule: "regexp/prefer-d", Severity: SeverityError, Line: 3},
		{Rule: "regexp/prefer-w", Severity: SeverityError, Line: 4},
		{Rule: "regexp/no-empty-alternative", Severity: SeverityError, Line: 5},
		{Rule: "regexp/no-empty-capturing-group", Severity: SeverityError, Line: 6},
		{Rule: "regexp/no-empty-group", Severity: SeverityError, Line: 7},
		{Rule: "regexp/no-empty-lookarounds-assertion", Severity: SeverityError, Line: 8},
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
