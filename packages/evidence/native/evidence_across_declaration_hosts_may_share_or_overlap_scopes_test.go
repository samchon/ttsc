package evidence

import "testing"

/**
 * Verifies positive evidence is a many-to-many relation between declaration
 * hosts and evidence scopes.
 *
 * One requirement may need success, refusal, and boundary implementations. A
 * broad implementation may also realize a requirement family while the same
 * or another host realizes one child rule. Neither shape is a duplicate.
 *
 *  1. Cite one target from two declaration hosts.
 *  2. Overlap parent and child scopes across different and identical hosts.
 *  3. Assert every positive graph remains valid.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies positive evidence is a many-to-many relation between declaration hosts and evidence scopes. The original assertions check assert every positive graph remains valid.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations One requirement may need success, refusal, and boundary implementations. A broad implementation may also realize a requirement family while the same or another host realizes one child rule. Neither shape is a duplicate. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite one target from two declaration hosts. Overlap parent and child scopes across different and identical hosts. Assert every positive graph remains valid. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestEvidenceAcrossDeclarationHostsMayShareOrOverlapScopes is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestEvidenceAcrossDeclarationHostsMayShareOrOverlapScopes(t *testing.T) {
  cases := map[string]map[string]string{
    "same target across hosts": {
      "docs/spec.md": "## Contract {#contract}\n",
      "src/first.ts": `/** @evidence docs/spec.md#contract Proves the success path. */
export function first(): void {}
`,
      "src/second.ts": `/** @evidence docs/spec.md#contract Proves the refusal path. */
export function second(): void {}
`,
    },
    "parent and child across hosts": {
      "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
      "src/parent.ts": `/** @evidence docs/spec.md#contract Implements the complete contract. */
export function parent(): void {}
`,
      "src/child.ts": `/** @evidence docs/spec.md#validation Implements validation. */
export function child(): void {}
`,
    },
    "parent and child on one host": {
      "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
      "src/claim.ts": `/**
 * @evidence docs/spec.md#contract Implements the complete contract.
 * @evidence docs/spec.md#validation Implements its validation rule.
 */
export function claim(): void {}
`,
    },
  }
  for name, files := range cases {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runIndexRule(t, files, acknowledgementIntentConfig))
    })
  }

  t.Run("same target across merged identity declarations", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/** @evidence docs/spec.md#contract Defines the contract shape. */
export interface Claim {}

/** @evidence docs/spec.md#contract Defines the contract namespace. */
export namespace Claim {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }]}`)
    assertNoProblems(t, messages)
  })
}
