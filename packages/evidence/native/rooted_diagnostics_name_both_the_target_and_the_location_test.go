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
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph runs graphRule.Check twice over a workspace whose Markdown population has root ../docs; the fully uncited document must report "Missing acknowledgement for 'requirements/pricing.md#discounts'" at "../docs/requirements/pricing.md:1", and the document with only discounts cited must report the uncited refunds heading at "../docs/requirements/pricing.md:3".
 * @evidence contracts/testing.md#independent-expectations The literal headings fix the expectations: the target is spelled relative to the declared root and the location ascends through the project to the physical file, with the heading's line number taken from the authored document, not from rule output.
 * @evidence contracts/testing.md#distinguishing-cases Each message must carry both address spellings at once; the second scenario adds a cited sibling heading so the reported line (3 rather than 1) proves the location follows the uncited heading. Assertions use contains-matching and do not assert the total finding count.
 * @evidence contracts/testing.md#execution-ownership TestRootedDiagnosticsNameBothTheTargetAndTheLocation is a selectable native Go unit entry. runRootedGraph writes the authored Markdown and TypeScript into a temp workspace, parses the TypeScript in-process and calls graphRule.Check; no consumer, build or product host is started.
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
  partial := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discount Policy {#discounts}\n\n## Refund Policy {#refunds}\n",
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Implements discounts. */\nexport interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript","files":["src/**/*.ts"],"symbol":"type",
    "reference":{"type":"markdown","root":"../docs","files":["requirements/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, partial, "Missing acknowledgement for 'requirements/pricing.md#refunds'")
  assertProblemContains(t, partial, "at ../docs/requirements/pricing.md:3")
}
