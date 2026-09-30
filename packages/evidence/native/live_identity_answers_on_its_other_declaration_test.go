package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the same position answers normally when nothing withdrew it.
 *
 * The negative twin of the two complementary cases. Both of them assert a refusal, and a
 * refusal is also what an over-applied withdrawal produces, so without this the
 * pair would keep passing if every merged identity started coming out withdrawn.
 * The fixture is the same merge with the withdrawal removed and nothing else
 * changed, derived from the shared constant so the two cannot drift apart while
 * this sentence goes on claiming they are one edit away from each other.
 *
 * A second section nobody cites is what keeps this from passing on silence. An
 * inactive claim is silent too, and so is a claim whose glob matches nothing,
 * so the acceptance is only visible as the one section that stays owed.
 *
 *  1. Declare the same merged identity with neither half withdrawn.
 *  2. Cite one of two sections from the same untagged declarator.
 *  3. Assert only the uncited section is reported.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert only the uncited section is reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The negative twin of the two complementary cases. Both of them assert a refusal, and a refusal is also what an over-applied withdrawal produces, so without this the pair would keep passing if every merged identity started coming out withdrawn. The fixture is the same merge with the withdrawal removed and nothing else changed, derived from the shared constant so the two cannot drift apart while this sentence goes on claiming they are one edit away from each other. The authored scenario requires this outcome: Assert only the uncited section is reported.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare the same merged identity with neither half withdrawn. Cite one of two sections from the same untagged declarator. Assert only the uncited section is reported.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestLiveIdentityAnswersOnItsOtherDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestLiveIdentityAnswersOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n\n## Uncited {#uncited}\n",
    "src/contracts.ts": strings.Replace(
      strings.Replace(mergedWithdrawnVariable, "%s", "@evidence", 1),
      internalBlock,
      "",
      1,
    ),
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertReported(t, messages, "Missing acknowledgement for 'docs/spec.md#uncited'")
}
