package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies claim independence: complementary partial claims cannot pool their
 * acknowledgements into one covered evidence population.
 *
 * Each claim sees the same two-unit denominator but acknowledges the opposite
 * half. A union-based implementation would report success even though neither
 * population can account for the complete evidence.
 *
 *  1. Materialize two Markdown evidence units behind two claims.
 *  2. Let each claim acknowledge only one unit.
 *  3. Assert each claim reports its own missing twin.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule materializes two independently selected functions citing opposite H2s and requires two missing findings plus both claim and target labels.
 * @evidence contracts/testing.md#independent-expectations Each claim owns the entire two-section denominator; complementary acknowledgements cannot be unioned across claims.
 * @evidence contracts/testing.md#distinguishing-cases Create and Cancel split coverage in both directions. Label and target fragments are checked globally, not paired within each individual diagnostic.
 * @evidence contracts/testing.md#execution-ownership TestClaimsCannotPoolPartialCoverage is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClaimsCannotPoolPartialCoverage(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Create
## Cancel
`,
    "src/a.ts": `
/** @evidence docs/spec.md#create Claim A implements creation. */
export function create(): void {}
`,
    "src/b.ts": `
/** @evidence docs/spec.md#cancel Claim B implements cancellation. */
export function cancel(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/a.ts"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/b.ts"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }
  ]}`)
  if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 2 {
    t.Fatalf("partial claims produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'docs/spec.md#cancel'")
  assertProblemContains(t, messages, "Claim 1")
  assertProblemContains(t, messages, "'docs/spec.md#create'")
  assertProblemContains(t, messages, "Claim 2")
}
