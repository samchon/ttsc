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
// @evidence contracts/testing.md#independent-expectations The expectations are literal states over index.ts and other.ts: a first edit that fails projection with a relative root must leave pending set and the committed generation/sequence unchanged. Recovery after the second edit must be incremental and changed, clear pending, advance the original base once, and contain FirstAfter and OtherAfter without BeforeEdit or OtherBefore. Committed shards also equal a full projection over the same compiler and extraction helpers; that differential comparison cannot independently detect a shared checker or extraction defect.
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
  initialGeneration := session.graphStore.generation
  initialSequence := session.graphStore.sequence

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
  if session.graphStore.generation != initialGeneration || session.graphStore.sequence != initialSequence {
    t.Fatal("failed first edit advanced the committed shard-store base")
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
  if recovered.BaseGeneration != initialGeneration || recovered.Sequence != initialSequence+1 {
    t.Fatalf("recovery did not advance the original base once: %#v", recovered)
  }
  foundFirst, foundOther := false, false
  for _, committed := range session.graphStore.shards {
    for _, node := range committed.shard.Nodes {
      switch node.Name {
      case "FirstAfter":
        foundFirst = true
      case "OtherAfter":
        foundOther = true
      case "BeforeEdit", "OtherBefore":
        t.Errorf("recovered store retained old declaration %q", node.Name)
      }
    }
  }
  if !foundFirst || !foundOther {
    t.Errorf("recovered store missed literal edits: FirstAfter=%v OtherAfter=%v", foundFirst, foundOther)
  }
  assertServeShardFactsMatchFullDump(t, session)
}
