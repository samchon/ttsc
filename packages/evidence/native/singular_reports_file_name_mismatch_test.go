package evidence

import (
  "testing"
)

/**
 * Verifies the name match fires: an identity whose name differs from its file
 * is reported with both repairs.
 *
 * A diagnostic that named only the mismatch would leave the reader to guess
 * which side moves, and either side is valid here.
 *
 *  1. Export one function under a name the file does not carry.
 *  2. Run the rule.
 *  3. Assert the message offers the rename in both directions.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert the message offers the rename in both directions.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A diagnostic that named only the mismatch would leave the reader to guess which side moves, and either side is valid here. The authored scenario requires this outcome: Assert the message offers the rename in both directions.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export one function under a name the file does not carry. Run the rule. Assert the message offers the rename in both directions.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularReportsFileNameMismatch runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsFileNameMismatch(t *testing.T) {
  messages := runSingularRule(t, "src/utils.ts", `
export function parseInput(value: string): string {
  return value;
}
`)
  assertReported(t, messages, "'utils.ts' declares 'parseInput'")
  assertReported(t, messages, "Rename the file to 'parseInput.ts'")
  assertReported(t, messages, "rename the identity to 'utils'")
}
