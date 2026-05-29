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
func TestFormatStatementSplitAbstainsOnEmptyStatements(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "const a = 1;;;\n",
  )
}
