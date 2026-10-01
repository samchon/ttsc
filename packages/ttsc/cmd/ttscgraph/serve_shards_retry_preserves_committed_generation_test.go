package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestServeShardsRetryPreservesCommittedGeneration verifies projection failure
// cannot advance the native shard store. The same captured compiler change is
// retried against the prior base and publishes exactly the next sequence only
// after every replacement validates.
//
// 1. Publish an initial shard store and capture its committed identity.
// 2. Edit a source, force a relative-root projection failure, then repair the root and retry.
// 3. Require failure to preserve the store and pending change, then publish exactly the next sequence against the prior generation on the incremental lane.
//
// @evidence contracts/testing.md#behavioral-verification Require failure to preserve the store and pending change, then publish exactly the next sequence against the prior generation on the incremental lane.
// @evidence contracts/testing.md#independent-expectations The expectations are literal states: with the session cwd set to a relative path the snapshot must fail with an error containing 'project root', return no snapshot, report unchanged state, keep the same committed store object and leave pending set; after the root is repaired the retry must be mode incremental, changed, with Sequence equal to the initial sequence plus one and BaseGeneration equal to the initial generation.
// @evidence contracts/testing.md#distinguishing-cases Publish an initial shard store and capture its committed identity. Edit a source, force a relative-root projection failure, then repair the root and retry. Require failure to preserve the store and pending change, then publish exactly the next sequence against the prior generation on the incremental lane.
// @evidence contracts/testing.md#execution-ownership TestServeShardsRetryPreservesCommittedGeneration is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsRetryPreservesCommittedGeneration(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  initial, _, _, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  committed := session.graphStore
  file := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(file, []byte("export class AfterRetry {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  session.cwd = "relative-project"
  snapshot, _, changed, err := snapshotGraphShardState(session)
  if err == nil || !strings.Contains(err.Error(), "project root") {
    t.Fatalf("projection error = %v, want absolute-root rejection", err)
  }
  if snapshot != nil || changed || session.graphStore != committed || session.pending == nil {
    t.Fatalf("failed transaction mutated publication state: snapshot:%v changed:%v store:%v pending:%v", snapshot != nil, changed, session.graphStore != committed, session.pending != nil)
  }

  session.cwd = root
  recovered, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if recovered == nil || mode != serveModeIncremental || !changed || recovered.Sequence != initial.Sequence+1 || recovered.BaseGeneration != initial.Generation {
    t.Fatalf("recovered transaction = snapshot:%#v mode:%q changed:%v", recovered, mode, changed)
  }
}
