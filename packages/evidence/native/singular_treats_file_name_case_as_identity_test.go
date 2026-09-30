package evidence

import (
  "testing"
)

/**
 * Verifies case sensitivity: a base name differing only in case is a mismatch.
 *
 * Path identity is case-sensitive on every host in this product, and a
 * case-insensitive filesystem must not soften it , otherwise the same
 * repository passes on Windows and fails on Linux.
 *
 *  1. Export `Button` from `button.tsx`.
 *  2. Run the rule.
 *  3. Assert the mismatch is reported.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the mismatch is reported.
 * @evidence contracts/testing.md#independent-expectations Path identity is case-sensitive on every host in this product, and a case-insensitive filesystem must not soften it , otherwise the same repository passes on Windows and fails on Linux. The authored scenario requires this outcome: Assert the mismatch is reported.
 * @evidence contracts/testing.md#distinguishing-cases Export `Button` from `button.tsx`. Run the rule. Assert the mismatch is reported.
 * @evidence contracts/testing.md#execution-ownership TestSingularTreatsFileNameCaseAsIdentity runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularTreatsFileNameCaseAsIdentity(t *testing.T) {
  messages := runSingularRule(t, "src/button.tsx", `
export const Button = (): null => null;
`)
  assertReported(t, messages, "'button.tsx' declares 'Button'")
}
