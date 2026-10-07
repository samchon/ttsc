package linthost

import "testing"

// TestFormatClauseJoinIdempotentOnJoinedBody verifies the rule abstains
// once the body already shares the header line.
//
// Idempotency keeps the format cascade converging: a joined `if (a) b();`
// has no newline in the header-to-body gap, so the rule must report
// nothing on a second pass.
//
//  1. Parse an already-joined `if`.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning rule must return no findings for an if body already on its header line, so a canonical input does not trigger another join during the cascade.
// @evidence contracts/testing.md#independent-expectations The supported joined form if (a) b(); already has a single space and no line break to replace. The no-finding oracle is independent of the rule edit calculation.
// @evidence contracts/testing.md#distinguishing-cases This test owns the canonical same-line negative; JoinsSingleIfBody supplies the identical short body separated by a newline as a positive. Idempotency here complements that transformation rather than proving it alone.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinIdempotentOnJoinedBody owns its no-finding fixture in the public Go unit population. The shared syntax-only harness calls the owning rule in process and starts no consumer install, native build or product host.
func TestFormatClauseJoinIdempotentOnJoinedBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (a) b();\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
