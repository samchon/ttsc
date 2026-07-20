package driver_test

import (
  "os"
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestModuleResolutionPredecessorsFindASymlinkedWinner verifies the selected
// target is located among the enumerated candidates when the compiler spells it
// through a different path than the importer does.
//
// The compiler resolves a package through the real path, so its selected target
// can arrive symlink-resolved while every candidate carries the importing
// file's spelling. A comparison that only matches characters never finds the
// winner, ModuleResolutionPredecessors then discards the whole predecessor
// list, and a resident session watches nothing for that import. This is the
// portable form of the Windows failure where an 8.3 short name expands.
//
//  1. Point a link directory at a real directory holding the selected value.js.
//  2. Ask for the predecessors of an import spelled through the link, naming
//     the winner by its real path.
//  3. Assert the higher-priority value.ts is reported and the lower-priority
//     value.jsx is not.
func TestModuleResolutionPredecessorsFindASymlinkedWinner(t *testing.T) {
  root := t.TempDir()
  real := filepath.Join(root, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(real, "value.js"), []byte("export function winner() {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  link := filepath.Join(root, "link")
  if err := os.Symlink(real, link); err != nil {
    t.Skipf("symbolic links unavailable on this host: %v", err)
  }

  predecessors := driver.ModuleResolutionPredecessors(
    nil,
    root,
    root,
    "./link/value",
    filepath.Join(real, "value.js"),
    true,
    driver.ModuleResolutionContext{},
  )

  if len(predecessors) == 0 {
    t.Fatal("a winner reached through a link must not discard its predecessors")
  }
  if !slices.Contains(predecessors, filepath.Join(link, "value.ts")) {
    t.Fatalf("missing higher-priority value.ts candidate: %v", predecessors)
  }
  if slices.Contains(predecessors, filepath.Join(link, "value.jsx")) {
    t.Fatalf("lower-priority value.jsx candidate must not be tracked: %v", predecessors)
  }
}
