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
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn runs the graph rule over a temp workspace holding docs/requirements/pricing.md and project/src/sale.ts, whose interface cites requirements/pricing.md#discounts under a Markdown reference rooted at the absolute workspace docs directory; the test asserts the rule reports no diagnostic.
 * @evidence contracts/testing.md#independent-expectations The expectation follows from the root contract that a citation is addressed relative to the declared root, not the project: the authored document defines a literal discounts heading and the citation names it by its root-relative path, so any resolver that ignores the absolute root would leave an unresolved citation diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases This is the positive absolute-root case only: one resolvable citation on the one selected heading. The negative case (an uncited heading owing an acknowledgement) is not exercised here, so the silence alone cannot distinguish a resolver that loaded no population.
 * @evidence contracts/testing.md#execution-ownership TestACitationUnderAnAbsoluteRootResolvesThroughTheRoot is a Go unit entry in the native test process; runRootedGraphIn writes the fixture files to a temp directory and calls the graph rule directly, with no installed consumer, built producer or product host.
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
