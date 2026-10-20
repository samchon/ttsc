package main

import (
  "bytes"
  "os"
  "path/filepath"
  "testing"
)

// Verifies every committed TypeScript 7.1 facade is the generator's output for
// the current bridges, and no facade outlives its bridge.
//
// A bridge edit that adds, renames or removes an export changes the documented
// plugin surface; this gate makes that drift fail instead of shipping silently.
//
//  1. Load every real bridge module below packages/ttsc/targets/7.1/bridge.
//  2. Render each facade and its go.mod in memory.
//  3. Compare with the committed files, in both directions.
//
// Adapted from Danny Wilson's TypeScript 7.1 port (#1727).
//
// @evidence contracts/testing.md#behavioral-verification Runs the production generate over the real bridge modules and compares exact bytes with each committed facade_gen.go and go.mod.
// @evidence contracts/testing.md#independent-expectations The committed files are the reviewed public surface; the generator must reproduce them rather than the test deriving its expectation from the same run.
// @evidence contracts/testing.md#distinguishing-cases A stale facade, a missing facade and an orphaned facade without a bridge each fail with their own message.
// @evidence contracts/testing.md#execution-ownership This tools/gen_facade unit loads the repository's bridge modules through go/packages in its own process and writes no file.
func TestCommittedFacadesMatchTheirBridges(t *testing.T) {
  target := filepath.Join("..", "..", "targets", "7.1")
  facadeRoot := filepath.Join(target, "facade")
  outputs, err := generate(filepath.Join(target, "bridge"), facadeRoot)
  if err != nil {
    t.Fatal(err)
  }
  generated := map[string]bool{}
  for _, output := range outputs {
    generated[output.path] = true
    current, err := os.ReadFile(output.path)
    if err != nil {
      t.Errorf("missing facade file %s: %v", output.path, err)
      continue
    }
    if !bytes.Equal(current, output.source) {
      t.Errorf("stale facade file %s; run go -C tools/gen_facade run .", output.path)
    }
  }
  err = filepath.WalkDir(facadeRoot, func(path string, entry os.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if name := entry.Name(); !entry.IsDir() && (name == outputName || name == "go.mod") && !generated[path] {
      t.Errorf("facade file %s has no bridge", path)
    }
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
}
