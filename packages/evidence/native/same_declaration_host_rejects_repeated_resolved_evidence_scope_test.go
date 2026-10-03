package evidence

import "testing"

/**
 * Verifies one declaration host cannot repeat one resolved positive scope.
 *
 * Duplicate spelling is not the boundary: aliases can resolve to the same
 * TypeScript unit, and separate JSDoc blocks can attach to one declaration.
 * Both still express one edge whose useful reasons must be combined.
 *
 *  1. Repeat one target in a single JSDoc block and across two blocks.
 *  2. Cite one TypeScript unit through two local import names.
 *  3. Assert each later edge is reported once with its canonical target.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule repeats an evidence target in one block, separate blocks, and two import aliases; assertSingleEvidenceDuplicate requires one canonical duplicate with retained coverage.
 * @evidence contracts/testing.md#independent-expectations Duplicate identity follows one physical declaration host and resolved scope, so aliases of get are not distinct evidence edges.
 * @evidence contracts/testing.md#distinguishing-cases Block boundaries and spelling differences challenge text-based deduplication while different positive hosts remain legal in EvidenceAcrossDeclarationHostsMayShareOrOverlapScopes.
 * @evidence contracts/testing.md#execution-ownership TestSameDeclarationHostRejectsRepeatedResolvedEvidenceScope is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestSameDeclarationHostRejectsRepeatedResolvedEvidenceScope(t *testing.T) {
  t.Run("one JSDoc block", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/**
 * @evidence docs/spec.md#contract Implements the contract.
 * @evidence docs/spec.md#contract Repeats the same claim.
 */
export function claim(): void {}
`,
    }, acknowledgementIntentConfig)
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })

  t.Run("separate JSDoc blocks", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Contract {#contract}\n",
      "src/claim.ts": `/** @evidence docs/spec.md#contract Implements the contract. */
/** @evidence docs/spec.md#contract Repeats the same claim. */
export function claim(): void {}
`,
    }, acknowledgementIntentConfig)
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })

  t.Run("two aliases for one resolved scope", func(t *testing.T) {
    messages := runIndexRule(t, map[string]string{
      "src/api.ts": "export function get(): void {}\n",
      "src/claim.ts": `import type { get, get as fetchContract } from "./api.js";

/**
 * @evidence {@link get} Implements the operation.
 * @evidence {@link fetchContract} Repeats the same resolved operation.
 */
export function claim(): void {}
`,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"function",
      "reference":{"type":"typescript","files":["src/api.ts"],"symbol":"function"}
    }]}`)
    assertSingleEvidenceDuplicate(t, messages, "get")
  })
}
