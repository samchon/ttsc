package evidence

import (
  "testing"
)

/**
 * Verifies the pruning predicate refuses every directory when no Markdown is
 * declared.
 *
 * The zero case, and the one that makes a TypeScript-only graph free: with no
 * Markdown reference anywhere in the configuration, the walk has no reason to
 * enter a single directory.
 *
 *  1. Configure a graph with no Markdown on either side.
 *  2. Ask the predicate about the directories a project always has.
 *  3. Assert every one of them is pruned.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification couldContainConfiguredMarkdown, resolvePopulationBase is exercised with the scenario below; the assertions require every one of them is pruned.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The zero case, and the one that makes a TypeScript-only graph free: with no Markdown reference anywhere in the configuration, the walk has no reason to enter a single directory.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a graph with no Markdown on either side. Ask the predicate about the directories a project always has. Assert every one of them is pruned.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownWalkPrunesEverythingWithoutAMarkdownReference is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestMarkdownWalkPrunesEverythingWithoutAMarkdownReference(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"typescript","files":["src/**"]}
  }]}`)
  base := resolvePopulationBase(root, "")
  for _, directory := range []string{"docs", "src", "node_modules", "test"} {
    if couldContainConfiguredMarkdown(config, base, directory) {
      t.Fatalf("'%s' must be pruned when no Markdown is declared", directory)
    }
  }
}
