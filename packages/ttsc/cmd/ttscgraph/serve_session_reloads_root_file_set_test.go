package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsRootFileSet checks reported reloads after include-glob
// addition and deletion, with the added name present and deleted name absent.
// Compiler-session identity and construction counts are not observed.
//
// A one-file UpdateProgram cannot add or remove config roots. The session must
// re-evaluate the tsconfig file set before source hashing and reload whenever
// that set changes.
//
// 1. Add `AddedRoot` under an included directory and assert reload plus presence.
// 2. Delete the original `BeforeEdit` root.
// 3. Assert another reload removes the deleted declaration.
//
// @evidence contracts/testing.md#behavioral-verification Adding src/added.ts reports reload with AddedRoot; deleting src/index.ts reports reload without BeforeEdit. The test owns these names and modes rather than compiler-session object identity, construction counts or the complete surviving node set.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over an include-based fixture: creating src/added.ts must give mode reload, changed, with a node named AddedRoot; deleting src/index.ts must give another mode reload, changed, whose dump no longer contains BeforeEdit. A session that kept stale roots would report incremental or unchanged.
// @evidence contracts/testing.md#distinguishing-cases Add `AddedRoot` under an included directory and assert reload plus presence; Delete the original `BeforeEdit` root; Assert another reload removes the deleted declaration.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsRootFileSet is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsRootFileSet(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  added := filepath.Join(root, "src", "added.ts")
  if err := os.WriteFile(added, []byte("export class AddedRoot {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "AddedRoot") {
    t.Fatalf("added root was not reloaded: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  if err := os.Remove(filepath.Join(root, "src", "index.ts")); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || hasDumpNode(*dump, "BeforeEdit") {
    t.Fatalf("deleted root remained in graph: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
