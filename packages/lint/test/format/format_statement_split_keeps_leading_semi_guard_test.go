package linthost

import "testing"

// TestFormatStatementSplitKeepsLeadingSemiGuard verifies statement-split
// does not break a statement off a leading-semicolon ASI guard
// (`;(expr)`).
//
// format/orphan-semi merges a lone `;` guard onto the statement it
// protects; statement-split must leave that line alone, or the two rules
// oscillate forever and the format cascade never converges. The `;` is a
// guard (not a `foo();bar()` terminator) when only whitespace precedes it
// to the start of its line.
//
//  1. Parse a merged `;(expr)` guard on its own line.
//  2. Run format/statement-split.
//  3. Assert the rule reports nothing (the line is not re-split).
func TestFormatStatementSplitKeepsLeadingSemiGuard(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/statement-split",
    "// guard\n;(bar as Baz).qux()\n",
    `{"tabWidth":2}`,
  )
}
