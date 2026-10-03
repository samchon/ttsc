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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim `operations` (reference docs/api.md) and a type claim `shapes` (reference docs/dto.md) over the same src/** population, where one EVIDENCE_EXCLUDE.ts carrier excludes `docs/api.md#operation` and `docs/dto.md#shape` beside a selected function and a selected interface; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the carrier contract: each exclusion must resolve into a reference owned by its own claim, so both headings are acknowledged without the carrier becoming a package-wide exemption.
 * @evidence contracts/testing.md#distinguishing-cases Two claims reading the same ledger with different Markdown populations; an exclusion applied to the wrong claim would leave one heading owed or report an unresolved target. Silence alone does not show claim isolation beyond that.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsExclusionCarriersClaimLocal is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
