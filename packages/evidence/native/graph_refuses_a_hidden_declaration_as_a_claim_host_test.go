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
 *
 * @evidence contracts/testing.md#behavioral-verification For each of `@internal`, `@hidden` and `@ignore` a t.Run subtest runs the graph rule with a function claim over src/api/health.ts, where the hidden-tagged `reset` also carries `@evidence docs/spec.md#contract` beside an untagged `check`; the diagnostics must contain `host kind 'unsupported or non-exported declaration' is not selected` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the withdrawal contract: a withdrawn declaration is neither selectable nor able to carry a citation, so the citation is reported rather than ignored and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Three hiding-tag spellings as separate subtests; the untagged `check` keeps the claim active so that refusal, not claim deactivation, explains the diagnostics.
 * @evidence contracts/testing.md#execution-ownership TestGraphRefusesAHiddenDeclarationAsAClaimHost is a Go unit entry in the native test process that owns three t.Run subtests over hiddenTagCases; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
