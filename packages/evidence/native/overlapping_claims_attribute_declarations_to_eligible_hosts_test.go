package evidence

import "testing"

/**
 * Verifies overlapping claim files attribute declarations by host eligibility.
 *
 * A type and each of its properties live in one file, so separate type and
 * property claims necessarily match the same inventory. Copying every
 * declaration into both claims made the type's parent-scope citation fail the
 * property claim even though each obligation had its own valid citation.
 *
 *  1. Select one file with separate type and property claims.
 *  2. Cite an H2 from the type and its selected H3 from the property.
 *  3. Assert both independent obligations pass without a false scope error.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies overlapping claim files attribute declarations by host eligibility. The original assertions check assert both independent obligations pass without a false scope error.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A type and each of its properties live in one file, so separate type and property claims necessarily match the same inventory. Copying every declaration into both claims made the type's parent-scope citation fail the property claim even though each obligation had its own valid citation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select one file with separate type and property claims. Cite an H2 from the type and its selected H3 from the property. Assert both independent obligations pass without a false scope error. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestOverlappingClaimsAttributeDeclarationsToEligibleHosts is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestOverlappingClaimsAttributeDeclarationsToEligibleHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Entity\n### Identifier\n",
    "src/entity.ts": `
/** @evidence docs/spec.md#entity The type implements the entity contract. */
export interface Entity {
  /** @evidence docs/spec.md#identifier This field implements the identifier contract. */
  id: string;
}
`,
  }, `{"claims":[
    {
      "name":"entity types",
      "type":"typescript",
      "files":["src/entity.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "name":"entity properties",
      "type":"typescript",
      "files":["src/entity.ts"],
      "symbol":"property",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h3"}
    }
  ]}`)
  assertNoProblems(t, messages)
}
