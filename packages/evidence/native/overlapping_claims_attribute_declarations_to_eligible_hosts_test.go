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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects Entity's type and id property through two claims and requires no diagnostics after H2/H3 citations.
 * @evidence contracts/testing.md#independent-expectations Each declaration belongs only to claims admitting its actual host kind; shared file inventory does not make both tags eligible everywhere.
 * @evidence contracts/testing.md#distinguishing-cases Different selectors and reference ranks detect indiscriminate copying, but the clean-only assertion does not independently establish activation of both claims.
 * @evidence contracts/testing.md#execution-ownership TestOverlappingClaimsAttributeDeclarationsToEligibleHosts is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
