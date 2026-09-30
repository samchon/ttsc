package evidence

import (
  "testing"
)

/**
 * Verifies a diagnostic about a rooted population names the file through the
 * project rather than through the root alone.
 *
 * A missing acknowledgement has to be repairable from the message, and the
 * target alone cannot do that here: `requirements/pricing.md` names no path a
 * reader can open from the project directory. The location therefore ascends,
 * while the target stays root-relative — the two answer different questions and
 * collapsing them would break one of them.
 *
 *  1. Leave a selected section uncited.
 *  2. Read the missing-acknowledgement diagnostic.
 *  3. Assert it carries the root-relative target and the ascending location.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph reports missing requirements/pricing.md#discounts and ../docs/requirements/pricing.md:1.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The literal uncited heading establishes root-relative target and physical repair location.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases One diagnostic retains both address meanings.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRootedDiagnosticsNameBothTheTargetAndTheLocation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestRootedDiagnosticsNameBothTheTargetAndTheLocation(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":          "export interface ISale {}\n",
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
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../docs/requirements/pricing.md:1")
}
