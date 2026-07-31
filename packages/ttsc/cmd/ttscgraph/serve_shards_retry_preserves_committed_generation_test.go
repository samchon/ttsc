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
func TestServeShardsRetryPreservesCommittedGeneration(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  initial, _, _, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  committed := session.graphStore
  file := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(file, []byte("export class AfterRetry {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  session.cwd = "relative-project"
  snapshot, _, changed, err := session.SnapshotShards()
  if err == nil || !strings.Contains(err.Error(), "project root") {
    t.Fatalf("projection error = %v, want absolute-root rejection", err)
  }
  if snapshot != nil || changed || session.graphStore != committed || session.pending == nil {
    t.Fatalf("failed transaction mutated publication state: snapshot:%v changed:%v store:%v pending:%v", snapshot != nil, changed, session.graphStore != committed, session.pending != nil)
  }

  session.cwd = root
  recovered, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if recovered == nil || mode != serveModeIncremental || !changed || recovered.Sequence != initial.Sequence+1 || recovered.BaseGeneration != initial.Generation {
    t.Fatalf("recovered transaction = snapshot:%#v mode:%q changed:%v", recovered, mode, changed)
  }
}
