package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a resolvable TypeScript root that selects nothing stays silent.
 *
 * This is the negative twin of the two cases above, and it guards the property
 * the repair could most easily overrun. A root that exists and simply admits no
 * Program source is an empty population, not a broken one: the claim
 * deactivates and owes no message. Reporting here would turn every staged or
 * sibling-package claim into build output.
 *
 *  1. Root a TypeScript claim at a directory that exists and holds no source.
 *  2. Read the diagnostics.
 *  3. Assert neither a root nor an empty-match diagnostic is produced.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph reports nothing for a readable root selecting no TypeScript declaration.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The workspace creates the root but has no matching source.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Readable empty selection differs from unresolvable roots.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAResolvableTypeScriptRootSelectingNothingStaysSilent is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestAResolvableTypeScriptRootSelectingNothingStaysSilent(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "shared/.keep":            "",
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../shared",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "a resolvable root selecting no host must deactivate in silence:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
