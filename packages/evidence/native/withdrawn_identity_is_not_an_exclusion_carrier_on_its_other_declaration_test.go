package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the same position is not an exclusion carrier either.
 *
 * Carrier eligibility reads the same host set through a wider door, so a leak
 * there is a second way for a withdrawn declaration to settle an obligation,
 * and the worse of the two: the reason field makes it read as a reviewed
 * decision rather than a citation.
 *
 *  1. Exclude the same section from the same untagged declarator.
 *  2. Evaluate the same claim.
 *  3. Assert the carrier is refused and the section stays owed.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the carrier is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations Carrier eligibility reads the same host set through a wider door, so a leak there is a second way for a withdrawn declaration to settle an obligation, and the worse of the two: the reason field makes it read as a reviewed decision rather than a citation. The authored scenario requires this outcome: Assert the carrier is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Exclude the same section from the same untagged declarator. Evaluate the same claim. Assert the carrier is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnIdentityIsNotAnExclusionCarrierOnItsOtherDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnIdentityIsNotAnExclusionCarrierOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Pricing {#pricing}\n",
    "src/contracts.ts": strings.Replace(mergedWithdrawnVariable, "%s", "@evidenceExclude", 1),
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "'unsupported or non-exported declaration' is not an eligible exclusion carrier",
  )
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}
