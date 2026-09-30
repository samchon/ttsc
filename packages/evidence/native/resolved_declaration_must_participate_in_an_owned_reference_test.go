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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a globally resolving tag cannot remain outside every owned reference. The original assertions check assert the tag is reported as non-participating with its repair context.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Resolution indexes the complete graph so two claims can share a source, but that global address table previously let a tag resolve through another claim's reference and then participate in nothing. An exclusion in that state is especially dangerous because it looks like an intentional coverage decision while changing no obligation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Expose one target only through a second claim's reference. Cite it with `@evidenceExclude` from the first claim. Assert the tag is reported as non-participating with its repair context. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestResolvedDeclarationMustParticipateInAnOwnedReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
