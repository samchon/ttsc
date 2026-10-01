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
 * @evidence contracts/testing.md#behavioral-verification declaredInputs calls graphRule.ProjectInputs (which decodes the configuration and runs graphProjectInputs) and assertDeclares requires exactly four glob inputs: the ledger and requirements directories two levels up with a trailing recursive wildcard, the absolute C:/shared/schema directory with a recursive wildcard for .prisma files, and the project docs directory with a trailing recursive wildcard.
 * @evidence contracts/testing.md#independent-expectations The expected patterns are literals written from the declared roots and globs (root joined to each glob), not read back from the rule; assertDeclares also fails on any extra pattern because it checks the set size.
 * @evidence contracts/testing.md#distinguishing-cases A Markdown claim root, a Markdown reference root, an absolute Prisma root and a reference with no root cover the rooted and unrooted spellings; exclusion globs, rooted TypeScript references and Swagger sources are not exercised here.
 * @evidence contracts/testing.md#execution-ownership TestRootedPopulationsPublishTheirResolvedGlobs is a selectable native Go unit entry. It evaluates the project-input contract on a literal configuration string in-process; the temp directory only supplies a project identity, no files are read and no watcher, consumer or product host runs.
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
