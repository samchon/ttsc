package linthost

import "testing"

// TestFormatStatementSplitAbstainsOnEmptyStatements verifies the rule
// ignores `;;` empty statements instead of spreading them across lines.
//
// Empty statements carry no content; splitting each onto its own line
// only multiplies blank-ish noise. The rule abstains on
// KindEmptyStatement, so a run of `;;;` stays put. This pins that guard.
//
//  1. Parse a line holding a statement followed by extra `;;`.
//  2. Run the rule.
//  3. Assert it emits no finding for the empty statements.
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must decline to split trailing empty statements after const a rather than multiplying content-free lines.
// @evidence contracts/testing.md#independent-expectations The literal extra semicolons are empty statements with no payload; preserving them without a split follows the rule contract independently of the AST visitor.
// @evidence contracts/testing.md#distinguishing-cases The adjacent empty-statement negative complements real two/three-statement splitting positives. This case asserts zero findings, not a source-read comparison.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitAbstainsOnEmptyStatements is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatStatementSplitAbstainsOnEmptyStatements(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "const a = 1;;;\n",
  )
}
