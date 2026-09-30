package evidence

import (
  "testing"
)

/**
 * Verifies a withdrawn declarator is not a claim host.
 *
 * The graph-level half of the complementary case: a declarator that reads its own
 * withdrawal tag registers no host at all, so the citation on it has nowhere to
 * live. The heading is asserted unacknowledged beside the refusal, because a
 * refusal alone would also be produced by a claim that never ran.
 *
 *  1. Cite a Markdown section from a withdrawn declarator.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The graph-level half of the complementary case: a declarator that reads its own withdrawal tag registers no host at all, so the citation on it has nowhere to live. The heading is asserted unacknowledged beside the refusal, because a refusal alone would also be produced by a claim that never ran. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from a withdrawn declarator. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestWithdrawnDeclaratorIsNotAClaimHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnDeclaratorIsNotAClaimHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `
export const live = 1,
  /**
   * @internal
   * @evidence docs/spec.md#pricing A withdrawn declarator carries nothing.
   */
  gone = 2;
`,
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
