package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies one directory declared two ways stays one base with a stated
 * spelling.
 *
 * Deduplication is by resolved path, so two declarations share a base and one of
 * the two spellings is what the loader-level root messages print. Which one has
 * to be decided rather than observed: a message that moves with configuration
 * order while claiming to name what the author wrote is worse than either
 * answer.
 *
 *  1. Declare one directory relatively and absolutely, in each order.
 *  2. Collect the configured bases.
 *  3. Assert one base survives, spelled the way the first declaration wrote it.
 * @evidence contracts/testing.md#behavioral-verification resolvePopulationBase, configuredBases is exercised with the scenario below; the assertions require one base survives, spelled the way the first declaration wrote it.
 * @evidence contracts/testing.md#independent-expectations Deduplication is by resolved path, so two declarations share a base and one of the two spellings is what the loader-level root messages print. Which one has to be decided rather than observed: a message that moves with configuration order while claiming to name what the author wrote is worse than either answer.
 * @evidence contracts/testing.md#distinguishing-cases Declare one directory relatively and absolutely, in each order. Collect the configured bases. Assert one base survives, spelled the way the first declaration wrote it.
 * @evidence contracts/testing.md#execution-ownership TestOneDirectoryDeclaredTwoWaysKeepsTheFirstSpelling is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestOneDirectoryDeclaredTwoWaysKeepsTheFirstSpelling(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  absolute := filepath.ToSlash(filepath.Join(workspace, "shared"))
  claimOf := func(declared string) claimSpec {
    return claimSpec{
      Type: artifactMarkdown,
      Root: declared,
      Base: resolvePopulationBase(root, declared),
    }
  }
  for _, order := range [][]string{
    {"../shared", absolute},
    {absolute, "../shared"},
  } {
    config := graphConfig{Claims: []claimSpec{claimOf(order[0]), claimOf(order[1])}}
    bases := configuredBases(config, artifactMarkdown)
    if len(bases) != 1 {
      t.Fatalf("one directory is one base, got %d for %v", len(bases), order)
    }
    if bases[0].Declared != order[0] {
      t.Fatalf(
        "the first declaration owns the spelling: got %q, want %q",
        bases[0].Declared,
        order[0],
      )
    }
  }
}
