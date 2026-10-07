package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsSameLineStatementSeparator verifies the
// `;` between two statements on the SAME line is kept under semi:false.
//
// `a = 1; b = 2` needs its separator: with no line terminator in the
// gap, ASI cannot fire and `a = 1 b = 2` is a SyntaxError. This direct
// semicolon entry does not execute statement splitting or a later cascade
// pass; it owns only the retained same-line separator. It is the negative
// twin of newline-separated stripping in TestFormatSemiHonorsPreferNeverOption.
//
//  1. Parse `a = 1; b = 2` (single line).
//  2. Run format/semi with prefer:"never".
//  3. Assert zero findings: the same-line successor keeps the `;`.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must offer no removal of the separator between a=1 and b=2 on the same line under never.
// @evidence contracts/testing.md#independent-expectations The literal source has no intervening line terminator, so removing its sole semicolon would make two assignments invalid; the no-finding oracle follows grammar independently.
// @evidence contracts/testing.md#distinguishing-cases This same-line negative complements safe newline-separated stripping and separate statement-split positives; this host does not claim to execute the full cascade.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverKeepsSameLineStatementSeparator is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning semicolon rule and observes zero findings in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiPreferNeverKeepsSameLineStatementSeparator(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/semi",
    "a = 1; b = 2\n",
    `{"prefer":"never"}`,
  )
}
