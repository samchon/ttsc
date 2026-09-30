package evidence

import (
  "testing"
)

/**
 * Verifies a rooted population is still addressed from its own base when the
 * project-relative spelling would also be legal.
 *
 * The negative twin of the case above. A resolver that quietly kept
 * project-relative targets would pass that case only if the author happened to
 * write `../docs/...`, and would then bind every citation to the citing
 * package's distance from the documents — which is the coupling this design
 * exists to remove. Naming the document the other way must fail.
 *
 *  1. Keep the same rooted population.
 *  2. Cite the document through the project-relative path instead.
 *  3. Assert the target does not resolve.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph reports the explicit unresolved ../docs/requirements/pricing.md#discounts target.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Declared-root addresses use requirements/pricing.md independently of the physical project-relative spelling.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases The selected document is unchanged while only citation spelling changes.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRootedTargetsRefuseTheProjectRelativeSpelling is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestRootedTargetsRefuseTheProjectRelativeSpelling(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence ../docs/requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../docs",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Unresolved evidence target '../docs/requirements/pricing.md#discounts'",
  )
}
