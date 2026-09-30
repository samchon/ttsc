package evidence

import "testing"

/**
 * Verifies a carrier ignores host kind without crossing claim-reference
 * boundaries in one overlapping file population.
 *
 * Two claims may read the same ledger, but each exclusion must still resolve
 * into a reference owned by that claim. Host relaxation must not turn one
 * declaration into a package-wide exemption.
 *
 *  1. Point function and type claims at the same carrier file.
 *  2. Give the claims distinct Markdown populations and exclude both targets.
 *  3. Assert each declaration participates only in the obligation it resolves.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a carrier ignores host kind without crossing claim-reference boundaries in one overlapping file population. The original assertions check assert each declaration participates only in the obligation it resolves.
 * @evidence contracts/testing.md#independent-expectations Two claims may read the same ledger, but each exclusion must still resolve into a reference owned by that claim. Host relaxation must not turn one declaration into a package-wide exemption. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Point function and type claims at the same carrier file. Give the claims distinct Markdown populations and exclude both targets. Assert each declaration participates only in the obligation it resolves. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsExclusionCarriersClaimLocal is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphKeepsExclusionCarriersClaimLocal(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/api.md": "## Operation\n",
    "docs/dto.md": "## Shape\n",
    "src/EVIDENCE_EXCLUDE.ts": `
/**
 * Shared central exclusions.
 *
 * @evidenceExclude docs/api.md#operation This package intentionally omits the operation.
 * @evidenceExclude docs/dto.md#shape This package intentionally omits the shape.
 */
export const EVIDENCE_EXCLUDE = true;
export function selectedOperation(): void {}
export interface SelectedShape {}
`,
  }, `{"claims":[{
    "name":"operations",
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/api.md"],"symbol":"h2"}
  },{
    "name":"shapes",
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/dto.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
