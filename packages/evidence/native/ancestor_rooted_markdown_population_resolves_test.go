package evidence

import (
  "testing"
)

/**
 * Verifies a Markdown population above the project resolves, and that its
 * targets are spelled relative to the declared root.
 *
 * This is the whole feature in one case. A monorepo keeps one requirements set
 * that several packages implement, and before `root` the ceiling was the ttsc
 * project root — so the only ways to compile were duplicating the documents per
 * package or gating one package and leaving the rest open. Root-relative
 * addressing is what makes the escape worth having: the same citation text
 * works in every package that declares the same base, so adopting a shared
 * document set costs nothing but the `root` line.
 *
 *  1. Place a requirements document beside the project rather than inside it.
 *  2. Cite it by its path inside the declared root, with no `..` in the target.
 *  3. Assert the graph closes.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph accepts the rooted discount citation with no diagnostics.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The literal heading and requirements/pricing.md citation belong to declared ../docs.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Ascending sibling-root success complements project-relative citation refusal.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAncestorRootedMarkdownPopulationResolves is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestAncestorRootedMarkdownPopulationResolves(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
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
  assertNoProblems(t, messages)
}
