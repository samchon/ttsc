package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies reference independence: one claim's reference array is one
 * obligation per element, so covering one reference cannot discharge another.
 *
 * Both references resolve through the same claim files and the same
 * declarations. Only the per-reference denominator keeps the second evidence
 * population owed, so coverage must be stored under claim and reference
 * indices rather than under the claim alone.
 *
 *  1. Give one claim two single-unit Markdown references.
 *  2. Acknowledge only the first reference's unit.
 *  3. Assert the second reference reports its own missing unit.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule gives one function two single-section references, acknowledges Alpha, and requires exactly one missing Beta finding naming reference 2.
 * @evidence contracts/testing.md#independent-expectations Reference-array entries are separate obligations; an Alpha citation cannot discharge docs/b.md#beta.
 * @evidence contracts/testing.md#distinguishing-cases Two different documents detect claim-wide pooling while keeping the source host and first reference healthy.
 * @evidence contracts/testing.md#execution-ownership TestReferencesRemainIndependentObligations is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestReferencesRemainIndependentObligations(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/a.md": "## Alpha\n",
    "docs/b.md": "## Beta\n",
    "src/ref.ts": `
/** @evidence docs/a.md#alpha The claim adopts Alpha. */
export function ref(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"function",
    "reference":[
      {"type":"markdown","files":["docs/a.md"],"symbol":"h2"},
      {"type":"markdown","files":["docs/b.md"],"symbol":"h2"}
    ]
  }]}`)
  if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 1 {
    t.Fatalf("independent references produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'docs/b.md#beta'")
  assertProblemContains(t, messages, "reference 2")
}
