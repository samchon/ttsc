package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies a resolved base carries the two spellings a diagnostic needs, and
 * that a root naming the project is the default base.
 *
 * The relative display is what a reader compares against every other path this
 * rule prints, and it must survive ascending. The default collapse matters
 * because `root: "."` and an omitted root would otherwise become two bases that
 * address the same files identically — two inventories, two obligations, one
 * document.
 *
 *  1. Resolve an ascending root, an absolute one, and one naming the project.
 *  2. Read the resolved absolute and display spellings.
 *  3. Assert the ascent survives and the project root collapses to the default.
 *
 * @evidence contracts/testing.md#behavioral-verification resolvePopulationBase preserves ../../docs display, computes workspace/docs absolute path and recognizes default roots.
 * @evidence contracts/testing.md#independent-expectations Native filepath.Join and literal display establish physical and authored identities separately.
 * @evidence contracts/testing.md#distinguishing-cases Ascending roots differ from omitted/dot default bases.
 * @evidence contracts/testing.md#execution-ownership TestPopulationBaseResolutionKeepsBothSpellings is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPopulationBaseResolutionKeepsBothSpellings(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "packages", "backend")
  ascending := resolvePopulationBase(root, "../../docs")
  if ascending.Default {
    t.Fatal("an ascending root is not the default base")
  }
  if ascending.Display != "../../docs" {
    t.Fatalf("ascending display = %q", ascending.Display)
  }
  if want := filepath.Join(workspace, "docs"); ascending.Absolute != want {
    t.Fatalf("ascending absolute = %q, want %q", ascending.Absolute, want)
  }
  for _, declared := range []string{"", ".", root, "../backend"} {
    if base := resolvePopulationBase(root, declared); !base.Default {
      t.Fatalf("root %q must resolve to the default base, got %+v", declared, base)
    }
  }
}
