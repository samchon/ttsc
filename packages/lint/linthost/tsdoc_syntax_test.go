package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestTSDocSyntaxReportsMalformedDocTags verifies jsdoc/tsdoc-syntax catches malformed TSDoc tags.
//
// Locks the source-scanning branch that validates JSDoc comments without
// relying on attached AST comment trivia. The rule should report only real
// documentation comments, while leaving JSDoc-looking string contents and
// fenced example code alone.
//
// 1. Parse a TypeScript file containing malformed inline and block TSDoc tags.
// 2. Run the native Engine with only jsdoc/tsdoc-syntax enabled.
// 3. Assert the diagnostic lines match the malformed doc comment lines.
//
// @evidence contracts/testing.md#behavioral-verification The TSDoc syntax scanner reports three malformed tags while ignoring literal shadows, fenced code and well-formed inline links.
// @evidence contracts/testing.md#independent-expectations The authored line-3 unclosed link, line-7 invalid inline tag and line-12 malformed block tag determine literal rule/severity/line expectations independently.
// @evidence contracts/testing.md#distinguishing-cases Ordinary strings, fenced examples, valid param/link tags and malformed inline/block syntax exercise both recognition and exemption paths.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngine.Run execute the authored source; this Test owns every literal normalized finding and the implicit clean controls. No consumer install or native product-host build/launch is used.
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
  findings := NewEngine(RuleConfig{"jsdoc/tsdoc-syntax": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: "jsdoc/tsdoc-syntax", Severity: SeverityError, Line: 3},
    {Rule: "jsdoc/tsdoc-syntax", Severity: SeverityError, Line: 7},
    {Rule: "jsdoc/tsdoc-syntax", Severity: SeverityError, Line: 12},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
