package evidence

import (
  "testing"
)

/**
 * Verifies the walk refuses to descend a directory no Markdown glob can reach.
 *
 * This is the pruning contract itself, and it is what keeps a cycle's cost
 * proportional to the declared document tree rather than to the repository. It
 * is a consequence of how the walk is written rather than anything stated, so
 * losing it would cost a full tree traversal per cycle; `node_modules`
 * included; while every result-level case stayed green.
 *
 *  1. Declare a Markdown reference under one directory.
 *  2. Ask the predicate about that directory and about unrelated ones.
 *  3. Assert only the reachable directory may be descended.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification couldContainConfiguredMarkdown, resolvePopulationBase is exercised with the scenario below; the assertions require only the reachable directory may be descended.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the pruning contract itself, and it is what keeps a cycle's cost proportional to the declared document tree rather than to the repository. It is a consequence of how the walk is written rather than anything stated, so losing it would cost a full tree traversal per cycle; `node_modules` included; while every result-level case stayed green.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a Markdown reference under one directory. Ask the predicate about that directory and about unrelated ones. Assert only the reachable directory may be descended.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownWalkPrunesUnreachableDirectories is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestMarkdownWalkPrunesUnreachableDirectories(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  base := resolvePopulationBase(root, "")
  for _, directory := range []string{"docs", "docs/guides"} {
    if !couldContainConfiguredMarkdown(config, base, directory) {
      t.Fatalf("'%s' can contain a configured document and must be descended", directory)
    }
  }
  for _, directory := range []string{"node_modules", "node_modules/pkg/lib", "src", "lib"} {
    if couldContainConfiguredMarkdown(config, base, directory) {
      t.Fatalf("'%s' can hold no configured document and must be pruned", directory)
    }
  }
}
