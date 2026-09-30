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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies one declaration host cannot repeat one resolved positive scope. The original assertions check assert each later edge is reported once with its canonical target.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Duplicate spelling is not the boundary: aliases can resolve to the same TypeScript unit, and separate JSDoc blocks can attach to one declaration. Both still express one edge whose useful reasons must be combined. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Repeat one target in a single JSDoc block and across two blocks. Cite one TypeScript unit through two local import names. Assert each later edge is reported once with its canonical target. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSameDeclarationHostRejectsRepeatedResolvedEvidenceScope is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
