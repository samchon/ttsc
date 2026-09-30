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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies disjoint, claim-local, and reference-local exclusions remain independent. The original assertions check assert none of the arrangements creates a duplicate.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Exclusion uniqueness belongs to one claim-reference obligation and only to scopes sharing a selected unit. Separate requirements or separate claims express separate reviewed decisions. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Exclude two disjoint targets in one claim. Exclude one physical target from separate claims and reference entries. Assert none of the arrangements creates a duplicate. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisjointClaimAndReferenceLocalExclusionsAreAllowed is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
