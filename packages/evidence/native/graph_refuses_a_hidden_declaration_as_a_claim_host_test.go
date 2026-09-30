package evidence

import (
  "testing"
)

/**
 * Verifies a withdrawn declaration is not a selected claim host.
 *
 * The exclusion applies to both sides of the graph, so a tagged declaration
 * must be unable to carry a citation as well as unable to owe one. Reporting
 * the citation rather than ignoring it is what keeps the claim's obligation
 * visible instead of quietly discharged.
 *
 *  1. Put an `@evidence` tag on a declaration that also carries the hiding tag,
 *     beside an untagged host that keeps the claim active.
 *  2. Evaluate a claim selecting that host kind.
 *  3. Assert the host is refused and the cited target is still owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the host is refused and the cited target is still owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The exclusion applies to both sides of the graph, so a tagged declaration must be unable to carry a citation as well as unable to owe one. Reporting the citation rather than ignoring it is what keeps the claim's obligation visible instead of quietly discharged. The authored scenario requires this outcome: Assert the host is refused and the cited target is still owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put an `@evidence` tag on a declaration that also carries the hiding tag, beside an untagged host that keeps the claim active. Evaluate a claim selecting that host kind. Assert the host is refused and the cited target is still owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphRefusesAHiddenDeclarationAsAClaimHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestGraphRefusesAHiddenDeclarationAsAClaimHost(t *testing.T) {
  for _, tag := range hiddenTagCases {
    t.Run(tag, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md": "## Contract\n",
        "src/api/health.ts": `
/**
 * ` + tag + ` Internal plumbing.
 *
 * @evidence docs/spec.md#contract This hidden host claims the section.
 */
export function reset(): void {}

export function check(): void {}
`,
      }, `{"claims":[{
        "type":"typescript",
        "files":["src/api/health.ts"],
        "symbol":"function",
        "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
      }]}`)
      assertProblemContains(
        t,
        messages,
        "host kind 'unsupported or non-exported declaration' is not selected",
      )
      assertProblemContains(
        t,
        messages,
        "Missing acknowledgement for 'docs/spec.md#contract'",
      )
    })
  }
}
