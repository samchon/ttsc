package evidence

import "testing"

/**
 * Verifies a mixed host can participate in every selector it actually has.
 *
 * TypeScript attaches one JSDoc block to a mixed variable statement whose
 * declarations classify as a function and a property. Choosing one owner would
 * make the other claim report missing even though the physical host supports
 * both selectors.
 *
 *  1. Put a function and property in one exported variable statement.
 *  2. Match the file from separate function and property claims.
 *  3. Assert the shared declaration satisfies both obligations.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a mixed host can participate in every selector it actually has. The original assertions check assert the shared declaration satisfies both obligations.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations TypeScript attaches one JSDoc block to a mixed variable statement whose declarations classify as a function and a property. Choosing one owner would make the other claim report missing even though the physical host supports both selectors. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put a function and property in one exported variable statement. Match the file from separate function and property claims. Assert the shared declaration satisfies both obligations. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestOverlappingClaimsKeepMixedHostsEligibleForSeveralClaims is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestOverlappingClaimsKeepMixedHostsEligibleForSeveralClaims(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/mixed.ts": `
/** @evidence docs/spec.md#contract Both exports implement this contract. */
export const execute = (): void => {}, value = 1;
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/mixed.ts"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/mixed.ts"],
      "symbol":"property",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }
  ]}`)
  assertNoProblems(t, messages)
}
