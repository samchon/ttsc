package main

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeSessionReloadsSourceDeletedDuringLoad verifies a program source
// that vanishes between compiler load and state capture is still detected.
//
// captureState hashes only sources it can read back from disk, so silently
// skipping a just-deleted file would drop it from every later freshness check:
// no root change, no source hash, no resolution candidate. The session must
// record the resident text instead so the next snapshot observes the deletion
// and reloads rather than serving the vanished declarations forever.
//
//  1. Load a session whose root imports `helper.ts`.
//  2. Delete `helper.ts` before capturing the freshness state.
//  3. Assert the next snapshot reloads and drops the deleted declaration.
func TestServeSessionReloadsSourceDeletedDuringLoad(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { helper } from './helper';\nexport function main(): void { helper(); }\n")
  writeGraphFile(t, filepath.Join(root, "src", "helper.ts"), "export function helper(): void {}\n")

  compiler, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if compiler == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  if err := os.Remove(filepath.Join(root, "src", "helper.ts")); err != nil {
    t.Fatal(err)
  }
  session := &graphSession{
    cwd:         root,
    tsconfig:    "tsconfig.json",
    compiler:    compiler,
    initialized: true,
  }
  defer session.Close()
  if err := session.captureState(); err != nil {
    t.Fatal(err)
  }

  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || hasDumpNode(*dump, "helper") {
    t.Fatalf("deleted-during-load source survived: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
