package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
)

/**
 * Verifies a rooted population publishes the root along with its patterns.
 *
 * The escape must not widen what the graph watches beyond what the author
 * declared, and it equally must not narrow it: a document above the project
 * that no host watches leaves a stale citation reporting green, which is the
 * one failure the input contract exists to remove. The host anchors a relative
 * pattern against the same project root this rule reads from and accepts one
 * that ascends, so the joined spelling is what reaches the right directory.
 *
 *  1. Configure Markdown and Prisma populations with declared roots.
 *  2. Publish the rule's project inputs.
 *  3. Assert each pattern arrives joined to the root it resolves against.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphProjectInputs publishes the explicitly asserted rooted globs.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal configured roots and independently written expected patterns establish dependencies.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Claims and references preserve external roots without running a live watcher.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRootedPopulationsPublishTheirResolvedGlobs is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestRootedPopulationsPublishTheirResolvedGlobs(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"markdown",
    "root":"../../docs",
    "files":["ledger/**"],
    "symbol":"file",
    "reference":[
      {"type":"markdown","root":"../../docs","files":["requirements/**"],"symbol":"h2"},
      {"type":"prisma","root":"C:/shared/schema","files":["**/*.prisma"]},
      {"type":"markdown","files":["docs/**"],"symbol":"h2"}
    ]
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{
    "../../docs/ledger/**",
    "../../docs/requirements/**",
    "C:/shared/schema/**/*.prisma",
    "docs/**",
  })
}
