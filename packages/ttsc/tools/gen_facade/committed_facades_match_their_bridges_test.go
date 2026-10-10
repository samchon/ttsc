package main

import (
  "bytes"
  "os"
  "path/filepath"
  "testing"
)

// TestCommittedFacadesMatchTheirBridges verifies every committed facade is the
// generator's output for the current bridges, and no facade outlives its bridge.
//
// A bridge edit that adds, renames or removes an export changes the documented
// plugin surface; this gate makes that drift fail instead of shipping silently.
//
//  1. Load every real bridge module below packages/ttsc/shim.
//  2. Render each facade in memory.
//  3. Compare with the committed facade_gen.go files, in both directions.
//
// @evidence contracts/testing.md#behavioral-verification Runs the production generate over the real bridge modules and compares exact bytes with each committed facade file.
// @evidence contracts/testing.md#independent-expectations The committed files are the reviewed public surface; the generator must reproduce them rather than the test deriving its expectation from the same run.
// @evidence contracts/testing.md#distinguishing-cases A stale facade, a missing facade and an orphaned facade without a bridge each fail with their own message.
// @evidence contracts/testing.md#execution-ownership This tools/gen_facade unit loads the repository's bridge modules through go/packages in its own process and writes no file.
func TestCommittedFacadesMatchTheirBridges(t *testing.T) {
  shimRoot := filepath.Join("..", "..", "shim")
  outputs, err := generate(shimRoot)
  if err != nil {
    t.Fatal(err)
  }
  generated := map[string]bool{}
  for _, output := range outputs {
    generated[output.path] = true
    current, err := os.ReadFile(output.path)
    if err != nil {
      t.Errorf("missing facade %s: %v", output.path, err)
      continue
    }
    if !bytes.Equal(current, output.source) {
      t.Errorf("stale facade %s; run go -C tools/gen_facade run .", output.path)
    }
  }
  committed, err := filepath.Glob(filepath.Join(shimRoot, facadeDirName, "*", outputName))
  if err != nil {
    t.Fatal(err)
  }
  nested, err := filepath.Glob(filepath.Join(shimRoot, facadeDirName, "*", "*", outputName))
  if err != nil {
    t.Fatal(err)
  }
  for _, path := range append(committed, nested...) {
    if !generated[path] {
      t.Errorf("facade %s has no bridge", path)
    }
  }
}
