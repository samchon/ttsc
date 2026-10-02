package evidence

import (
  "testing"
)

/**
 * Verifies case sensitivity: a base name differing only in case is a mismatch.
 *
 * Path identity is case-sensitive on every host in this product, and a
 * case-insensitive filesystem must not soften it, otherwise the same
 * repository passes on Windows and fails on Linux.
 *
 *  1. Export `Button` from `button.tsx`.
 *  2. Run the rule.
 *  3. Assert the mismatch is reported.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule parses src/button.tsx exporting const Button and runs singularRule.Check; assertReported requires exactly one diagnostic containing "'button.tsx' declares 'Button'".
 * @evidence contracts/testing.md#independent-expectations The expected diagnostic is an authored literal following the contract that a file takes its public identity's name exactly: base name 'button' against identity 'Button' must mismatch. The oracle is the literal text, not the rule's own computation.
 * @evidence contracts/testing.md#distinguishing-cases One negative case whose only difference from a matching file is letter case of the base name. The exact-match accepting case and the multi-identity and anonymous-default findings are not executed here; no filesystem case-folding is involved, only the rule's string comparison.
 * @evidence contracts/testing.md#execution-ownership TestSingularTreatsFileNameCaseAsIdentity is a selectable native Go unit entry. It parses one source string through runSingularRule and invokes singularRule.Check in-process; no consumer, Node process, native build or product host is started.
 */
func TestSingularTreatsFileNameCaseAsIdentity(t *testing.T) {
  messages := runSingularRule(t, "src/button.tsx", `
export const Button = (): null => null;
`)
  assertReported(t, messages, "'button.tsx' declares 'Button'")
}
