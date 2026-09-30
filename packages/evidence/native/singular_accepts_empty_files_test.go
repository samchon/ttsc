package evidence

import (
  "testing"
)

/**
 * Verifies an empty source file is silent.
 *
 * The zero case for the whole rule: no statements means no identity, and a
 * walker that assumed at least one would fault on the emptiest input a project
 * can contain.
 *
 *  1. Parse a file with no statements.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The zero case for the whole rule: no statements means no identity, and a walker that assumed at least one would fault on the emptiest input a project can contain. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parse a file with no statements. Run the rule. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularAcceptsEmptyFiles runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularAcceptsEmptyFiles(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/blank.ts", ""))
}
