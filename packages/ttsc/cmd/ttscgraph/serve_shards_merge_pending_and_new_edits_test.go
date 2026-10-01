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
//
// 1. Publish index.ts and OtherBefore in a committed shard generation.
// 2. Change the first file, force a relative-root projection error, repair the root and change the second file.
// 3. Require the pending first change and new second change to commit together on the incremental lane, clear pending state and match a full projection.
//
// @evidence contracts/testing.md#behavioral-verification Require the pending first change and new second change to commit together on the incremental lane, clear pending state and match a full projection.
// @evidence contracts/testing.md#independent-expectations The literal fixture and the supported graph contract establish these expectations: Require the pending first change and new second change to commit together on the incremental lane, clear pending state and match a full projection. The full projection comparison uses another lane over the same compiler and extraction helpers, so it cannot independently detect a shared checker or extraction defect.
// @evidence contracts/testing.md#distinguishing-cases Publish index.ts and OtherBefore in a committed shard generation. Change the first file, force a relative-root projection error, repair the root and change the second file. Require the pending first change and new second change to commit together on the incremental lane, clear pending state and match a full projection.
// @evidence contracts/testing.md#execution-ownership TestServeShardsMergePendingAndNewEdits is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsMergePendingAndNewEdits(t *testing.T) {
  root := graphSessionFixture(t)
  other := filepath.Join(root, "src", "other.ts")
  writeGraphFile(t, other, "export class OtherBefore {}\n")
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
    t.Fatalf("initial snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }

  first := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(first, []byte("export class FirstAfter {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  session.cwd = "relative-project"
  if _, _, _, err := snapshotGraphShardState(session); err == nil {
    t.Fatal("first edit unexpectedly committed through invalid project root")
  }
  if session.pending == nil {
    t.Fatal("failed first edit left no pending invalidation")
  }

  session.cwd = root
  if err := os.WriteFile(other, []byte("export class OtherAfter {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  recovered, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if recovered == nil || mode != serveModeIncremental || !changed || session.pending != nil {
    t.Fatalf("merged recovery = snapshot:%v mode:%q changed:%v pending:%v", recovered != nil, mode, changed, session.pending != nil)
  }
  assertServeShardFactsMatchFullDump(t, session)
}
