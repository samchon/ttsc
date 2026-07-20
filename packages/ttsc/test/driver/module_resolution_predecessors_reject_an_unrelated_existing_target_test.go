package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestModuleResolutionPredecessorsRejectAnUnrelatedExistingTarget verifies an
// existing candidate that is a different file from the selected target is not
// mistaken for it.
//
// This is the negative twin of the symlinked-winner case. Locating the winner
// by filesystem identity must not degrade into "the first candidate that
// exists": that would cut the predecessor list at an unrelated file and hide
// the very probes a resident session has to watch. When the winner is genuinely
// not enumerable, the conservative empty answer is still correct.
//
//  1. Create an existing candidate that is not the resolved target.
//  2. Ask for the predecessors, naming a resolved target outside the search.
//  3. Assert nothing is reported rather than a list cut at the decoy.
func TestModuleResolutionPredecessorsRejectAnUnrelatedExistingTarget(t *testing.T) {
  root := t.TempDir()
  source := filepath.Join(root, "src")
  if err := os.MkdirAll(source, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(source, "value.js"), []byte("export function decoy() {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  elsewhere := filepath.Join(root, "elsewhere.js")
  if err := os.WriteFile(elsewhere, []byte("export function winner() {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  predecessors := driver.ModuleResolutionPredecessors(
    nil,
    source,
    root,
    "./value",
    elsewhere,
    true,
    driver.ModuleResolutionContext{},
  )

  if len(predecessors) != 0 {
    t.Fatalf("an unenumerable winner must report no predecessors: %v", predecessors)
  }
}
