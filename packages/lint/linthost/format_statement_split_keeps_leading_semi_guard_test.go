package linthost

import "testing"

// TestFormatStatementSplitKeepsLeadingSemiGuard verifies statement-split
// does not break a statement off a leading-semicolon ASI guard
// (`;(expr)`).
//
// format/orphan-semi merges a lone `;` guard onto the statement it
// protects. This direct entry starts with that authored merged shape and
// checks statement-split alone; it does not run orphan-semi or a cascade.
// Preserving the shape avoids proposing a competing split. The `;` is a
// guard (not a `foo();bar()` terminator) when only whitespace precedes it
// to the start of its line.
//
//  1. Parse a merged `;(expr)` guard on its own line.
//  2. Run format/statement-split.
//  3. Assert the rule reports nothing (the line is not re-split).
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must leave the leading semicolon attached to the cast expression it protects, preventing conflict with orphan-semicolon canonicalization.
// @evidence contracts/testing.md#independent-expectations The literal line begins with an ASI guard rather than a previous statement terminator; preserving its association follows the guard contract independently of whitespace scanning.
// @evidence contracts/testing.md#distinguishing-cases The protected ;(bar as Baz).qux call is the no-op counterpart to ordinary terminated-statement splitting; the leading comment line is retained fixture context.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitKeepsLeadingSemiGuard is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and observes its no-finding result in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitKeepsLeadingSemiGuard(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/statement-split",
    "// guard\n;(bar as Baz).qux()\n",
    `{"tabWidth":2}`,
  )
}
