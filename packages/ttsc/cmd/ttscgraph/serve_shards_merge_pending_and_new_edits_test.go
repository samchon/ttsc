package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsMergePendingAndNewEdits verifies a second disk edit cannot
// replace the invalidation closure of an earlier uncommitted generation. Both
// changed sources must enter the retry transaction before it can advance the
// shard-store base.
func TestServeShardsMergePendingAndNewEdits(t *testing.T) {
  root := graphSessionFixture(t)
  other := filepath.Join(root, "src", "other.ts")
  writeGraphFile(t, other, "export class OtherBefore {}\n")
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := session.SnapshotShards(); err != nil || snapshot == nil {
    t.Fatalf("initial snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }

  first := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(first, []byte("export class FirstAfter {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  session.cwd = "relative-project"
  if _, _, _, err := session.SnapshotShards(); err == nil {
    t.Fatal("first edit unexpectedly committed through invalid project root")
  }
  if session.pending == nil {
    t.Fatal("failed first edit left no pending invalidation")
  }

  session.cwd = root
  if err := os.WriteFile(other, []byte("export class OtherAfter {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  recovered, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if recovered == nil || mode != serveModeIncremental || !changed || session.pending != nil {
    t.Fatalf("merged recovery = snapshot:%v mode:%q changed:%v pending:%v", recovered != nil, mode, changed, session.pending != nil)
  }
  assertServeShardFactsMatchFullDump(t, session)
}
