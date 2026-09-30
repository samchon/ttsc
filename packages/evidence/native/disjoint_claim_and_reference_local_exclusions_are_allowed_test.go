package evidence

import "testing"

/**
 * Verifies disjoint, claim-local, and reference-local exclusions remain
 * independent.
 *
 * Exclusion uniqueness belongs to one claim-reference obligation and only to
 * scopes sharing a selected unit. Separate requirements or separate claims
 * express separate reviewed decisions.
 *
 *  1. Exclude two disjoint targets in one claim.
 *  2. Exclude one physical target from separate claims and reference entries.
 *  3. Assert none of the arrangements creates a duplicate.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule requires silence for disjoint exclusions, separate named claims excluding one target, and duplicate reference entries answered by one exclusion.
 * @evidence contracts/testing.md#independent-expectations Exclusion uniqueness is scoped to a claim-reference obligation and intersecting selected units, so these authored arrangements are legal.
 * @evidence contracts/testing.md#distinguishing-cases Three local subtests vary scope overlap and obligation identity; silence alone would also pass if claim activation were lost, which this entry does not independently inspect.
 * @evidence contracts/testing.md#execution-ownership TestDisjointClaimAndReferenceLocalExclusionsAreAllowed is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestDisjointClaimAndReferenceLocalExclusionsAreAllowed(t *testing.T) {
  t.Run("disjoint scopes", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Create {#create}\n## Cancel {#cancel}\n",
      "src/create.ts": `/** @evidenceExclude docs/spec.md#create Creation belongs elsewhere. */
export function create(): void {}
`,
      "src/cancel.ts": `/** @evidenceExclude docs/spec.md#cancel Cancellation belongs elsewhere. */
export function cancel(): void {}
`,
    }, acknowledgementIntentConfig)
    assertNoProblems(t, messages)
  })
  t.Run("separate claims", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/backend.ts": `/** @evidenceExclude docs/spec.md#contract Frontend owns this presentation rule. */
export function backend(): void {}
`,
      "src/frontend.ts": `/** @evidenceExclude docs/spec.md#contract Backend owns this persistence rule. */
export function frontend(): void {}
`,
    }, `{"claims":[
      {"name":"backend","type":"typescript","files":["src/backend.ts"],"symbol":"function","reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}},
      {"name":"frontend","type":"typescript","files":["src/frontend.ts"],"symbol":"function","reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}}
    ]}`)
    assertNoProblems(t, messages)
  })
  t.Run("separate references", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/** @evidenceExclude docs/spec.md#contract This claim does not own the contract. */
export function claim(): void {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"function",
      "reference":[
        {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"},
        {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
      ]
    }]}`)
    assertNoProblems(t, messages)
  })
}
