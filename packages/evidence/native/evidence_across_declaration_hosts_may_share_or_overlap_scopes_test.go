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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule requires clean graphs for shared targets, parent/child positive scopes on one or different hosts, and copied citations across a merged interface/namespace.
 * @evidence contracts/testing.md#independent-expectations Positive evidence is many-to-many; overlap is legal across scopes and merged declarations unlike contradictory exclusion intent.
 * @evidence contracts/testing.md#distinguishing-cases The table and merged-identity subtest preserve distinct arrangements, but clean results alone do not certify that their claim populations stayed active.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceAcrossDeclarationHostsMayShareOrOverlapScopes is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
