package evidence

import (
  "testing"
)

/**
 * Verifies exclusion position independence: moving an exclusion between two
 * eligible Markdown hosts leaves the acknowledged source unit unchanged.
 *
 * The exclusion belongs to the claim group, not to the heading where the
 * author happened to record it. Both placements remain subject to the H2 host
 * selector, while their host identity cannot alter coverage.
 *
 *  1. Place one exclusion under the first selected H2 host.
 *  2. Move the same exclusion under a second selected H2 host.
 *  3. Assert both graphs satisfy the same source unit.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies exclusion position independence: moving an exclusion between two eligible Markdown hosts leaves the acknowledged source unit unchanged.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Both authored H2 placements carry the same exclusion of contract and must discharge the same obligation; position cannot change the exclusion target.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Place one exclusion under the first selected H2 host. Move the same exclusion under a second selected H2 host. Assert both graphs satisfy the same source unit.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownExclusionIsPositionIndependentAcrossEligibleHosts is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestMarkdownExclusionIsPositionIndependentAcrossEligibleHosts(t *testing.T) {
  config := `{"claims":[{
    "type":"markdown",
    "files":["refs/ledger.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`
  for name, ledger := range map[string]string{
    "first": `## First host
<!-- @evidenceExclude docs/spec.md#contract This ledger intentionally does not implement the contract. -->
## Second host
`,
    "second": `## First host
## Second host
<!-- @evidenceExclude docs/spec.md#contract This ledger intentionally does not implement the contract. -->
`,
  } {
    t.Run(name, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md":   "## Contract\n",
        "refs/ledger.md": ledger,
      }, config)
      assertNoProblems(t, messages)
    })
  }
}
