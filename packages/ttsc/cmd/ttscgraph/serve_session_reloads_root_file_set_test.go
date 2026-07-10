package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsRootFileSet verifies include-glob additions and
// deletions replace the compiler session rather than leaving stale roots.
//
// A one-file UpdateProgram cannot add or remove config roots. The session must
// re-evaluate the tsconfig file set before source hashing and reload whenever
// that set changes.
//
// 1. Add `AddedRoot` under an included directory and assert reload plus presence.
// 2. Delete the original `BeforeEdit` root.
// 3. Assert another reload removes the deleted declaration.
func TestServeSessionReloadsRootFileSet(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  added := filepath.Join(root, "src", "added.ts")
  if err := os.WriteFile(added, []byte("export class AddedRoot {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "AddedRoot") {
    t.Fatalf("added root was not reloaded: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  if err := os.Remove(filepath.Join(root, "src", "index.ts")); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || hasDumpNode(*dump, "BeforeEdit") {
    t.Fatalf("deleted root remained in graph: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
