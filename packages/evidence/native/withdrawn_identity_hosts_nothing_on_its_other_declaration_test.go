package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a withdrawn identity hosts nothing on its other declaration.
 *
 * The sharpest form of the asymmetry. A
 * declarator that carries no tag of its own registers a host, so an identity
 * withdrawn by a sibling declaration kept a live position, and a declaration
 * the author had taken out of the API went on discharging coverage with no
 * diagnostic anywhere. Reaching it needs the reconciliation over finished
 * identities, which walks a unit's nodes, so the position had to be one of
 * them.
 *
 *  1. Withdraw a namespace variable in one declaration of a merge.
 *  2. Cite a section from the same identity's untagged declarator in the other.
 *  3. Assert the host is refused and the section stays owed.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations The sharpest form of the asymmetry. A declarator that carries no tag of its own registers a host, so an identity withdrawn by a sibling declaration kept a live position, and a declaration the author had taken out of the API went on discharging coverage with no diagnostic anywhere. Reaching it needs the reconciliation over finished identities, which walks a unit's nodes, so the position had to be one of them. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw a namespace variable in one declaration of a merge. Cite a section from the same identity's untagged declarator in the other. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnIdentityHostsNothingOnItsOtherDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnIdentityHostsNothingOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Pricing {#pricing}\n",
    "src/contracts.ts": strings.Replace(mergedWithdrawnVariable, "%s", "@evidence", 1),
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "host kind 'unsupported or non-exported declaration' is not selected (property)",
  )
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}
