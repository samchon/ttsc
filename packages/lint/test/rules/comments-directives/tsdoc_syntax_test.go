package linthost

import (
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestTSDocSyntaxReportsMalformedDocTags verifies tsdoc/syntax catches malformed TSDoc tags.
//
// Locks the source-scanning branch that validates JSDoc comments without
// relying on attached AST comment trivia. The rule should report only real
// documentation comments, while leaving JSDoc-looking string contents and
// fenced example code alone.
//
// 1. Parse a TypeScript file containing malformed inline and block TSDoc tags.
// 2. Run the native Engine with only tsdoc/syntax enabled.
// 3. Assert the diagnostic lines match the malformed doc comment lines.
func TestTSDocSyntaxReportsMalformedDocTags(t *testing.T) {
	source := `const shadow = "/** {@link Missing */";
/**
 * Links to {@link Missing
 */
export function one(): void {}
/**
 * Bad inline {@ bad}
 */
export function two(): void {}
/**
 * @param name - ok
 * @ bad
 */
export function three(name: string): string { return name; }
/**
 * ` + "```ts" + `
 * const sample = "{@link Missing";
 * ` + "```" + `
 * @remarks good {@link Thing}
 */
export const ok = 1;
`
	file := parseTS(t, source)
	findings := NewEngine(RuleConfig{"tsdoc/syntax": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
	actual := normalizeRuleFindings(file, findings)
	expected := []ruleExpectation{
		{Rule: "tsdoc/syntax", Severity: SeverityError, Line: 3},
		{Rule: "tsdoc/syntax", Severity: SeverityError, Line: 7},
		{Rule: "tsdoc/syntax", Severity: SeverityError, Line: 12},
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
