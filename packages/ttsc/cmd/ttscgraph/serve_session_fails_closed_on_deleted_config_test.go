package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionFailsClosedOnDeletedConfig verifies removing the project
// config fails the snapshot without poisoning the resident session.
//
// The boundary twin of the invalid-config case: deletion takes the
// hashesChanged ErrNotExist branch and its forced reload fails at session
// construction rather than config parsing. A byte-identical restore must then
// report unchanged — the resident graph still matches the disk exactly — and
// the compiler session must keep serving incremental edits, proving the
// failed reload episode left no partial state behind.
//
//  1. Build a valid initial graph, then delete tsconfig.json.
//  2. Assert the snapshot fails with no dump.
//  3. Restore the identical config and assert the snapshot is unchanged.
//  4. Edit the source and assert an incremental refresh still works.
//
// @evidence contracts/testing.md#behavioral-verification Verifies removing the project config fails the snapshot without poisoning the resident session.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish "unchanged", "incremental"; Restore the identical config and assert the snapshot is unchanged. 4. Edit the source and assert an incremental refresh still works.
// @evidence contracts/testing.md#distinguishing-cases Build a valid initial graph, then delete tsconfig.json; Assert the snapshot fails with no dump; Restore the identical config and assert the snapshot is unchanged. 4. Edit the source and assert an incremental refresh still works.
// @evidence contracts/testing.md#execution-ownership TestServeSessionFailsClosedOnDeletedConfig is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionFailsClosedOnDeletedConfig(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  config := filepath.Join(root, "tsconfig.json")
  saved, err := os.ReadFile(config)
  if err != nil {
    t.Fatal(err)
  }
  if err := os.Remove(config); err != nil {
    t.Fatal(err)
  }
  dump, _, changed, err := snapshotGraphState(session)
  if err == nil || dump != nil || changed {
    t.Fatalf("deleted config must fail closed: dump:%v changed:%v err:%v", dump != nil, changed, err)
  }

  if err := os.WriteFile(config, saved, 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != "unchanged" || changed {
    t.Fatalf("identical restored config must be unchanged: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  if err := os.WriteFile(filepath.Join(root, "src", "index.ts"), []byte("export class AfterEdit {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "incremental" || !changed || !hasDumpNode(*dump, "AfterEdit") {
    t.Fatalf("session did not survive the failed reload: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
