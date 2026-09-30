package evidence

import "testing"

/**
 * Verifies a globally resolving tag cannot remain outside every owned reference.
 *
 * Resolution indexes the complete graph so two claims can share a source, but
 * that global address table previously let a tag resolve through another
 * claim's reference and then participate in nothing. An exclusion in that state
 * is especially dangerous because it looks like an intentional coverage
 * decision while changing no obligation.
 *
 *  1. Expose one target only through a second claim's reference.
 *  2. Cite it with `@evidenceExclude` from the first claim.
 *  3. Assert the tag is reported as non-participating with its repair context.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule resolves a Claim exclusion only through Other's reference and requires non-participation, its source location, owning claim context and repair text.
 * @evidence contracts/testing.md#independent-expectations Global resolution does not confer participation: Claim owns docs/owed.md, while only Other owns docs/stray.md.
 * @evidence contracts/testing.md#distinguishing-cases The healthy Other citation makes the target resolvable, distinguishing this placement error from an unresolved target; total findings are not asserted.
 * @evidence contracts/testing.md#execution-ownership TestResolvedDeclarationMustParticipateInAnOwnedReference is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestResolvedDeclarationMustParticipateInAnOwnedReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/owed.md":  "## Owed\n",
    "docs/stray.md": "## Stray\n",
    "src/claim.ts": `
/** @evidenceExclude docs/stray.md#stray This claim intentionally omits the wrong population. */
export interface Claim {}
`,
    "src/other.ts": `
/** @evidence docs/stray.md#stray This claim owns the target. */
export interface Other {}
`,
  }, `{"claims":[
    {
      "name":"claim",
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/owed.md"],"symbol":"h2"}
    },
    {
      "name":"other",
      "type":"typescript",
      "files":["src/other.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/stray.md"],"symbol":"h2"}
    }
  ]}`)
  assertProblemContains(t, messages, "Non-participating @evidenceExclude target 'docs/stray.md#stray'")
  assertProblemContains(t, messages, "src/claim.ts:2")
  assertProblemContains(t, messages, "Claim 1 ('claim') across reference 1")
  assertProblemContains(t, messages, "must discharge at least one obligation")
}
