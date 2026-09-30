package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies a citation under an absolute root resolves through the root, not
 * through the project.
 *
 * The address space belongs to the base and nothing about naming the property
 * differently may reach it. Without this the uncited absolute-root case would pass under a
 * resolver that had quietly stopped loading the population at all, since a
 * document nobody selected owes no acknowledgement either.
 *
 *  1. Root the same reference absolutely.
 *  2. Cite the document by its path inside that root.
 *  3. Assert the graph closes.
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require the graph closes.
 * @evidence contracts/testing.md#independent-expectations The address space belongs to the base and nothing about naming the property differently may reach it. Without this the uncited absolute-root case would pass under a resolver that had quietly stopped loading the population at all, since a document nobody selected owes no acknowledgement either.
 * @evidence contracts/testing.md#distinguishing-cases Root the same reference absolutely. Cite the document by its path inside that root. Assert the graph closes.
 * @evidence contracts/testing.md#execution-ownership TestACitationUnderAnAbsoluteRootResolvesThroughTheRoot is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestACitationUnderAnAbsoluteRootResolvesThroughTheRoot(t *testing.T) {
  workspace := t.TempDir()
  docs := filepath.ToSlash(filepath.Join(workspace, "docs"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"`+docs+`",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertNoProblems(t, messages)
}
