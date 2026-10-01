package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsDeleteRemovedSource verifies a root-set reload names the
// superseded source shard explicitly while publishing a complete replacement
// generation. A consumer never has to infer deletion from a missing payload.
//
// 1. Publish index.ts and keep.ts as the initial source shards.
// 2. Delete index.ts and publish the resulting source change.
// 3. Require a reload delta based on the initial generation, deletion of the removed key and retention of the keep key.
//
// @evidence contracts/testing.md#behavioral-verification Deleting a root source makes the next shard snapshot a reload delta based on the initial generation that names the removed source's shard key in Deletes while the remaining source keeps its key in the committed store.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a two-source fixture: after src/index.ts is removed the snapshot must be mode reload and changed with BaseGeneration equal to the initial generation, its Deletes must contain the shard key the store held for index.ts, and the committed store must drop index.ts and keep a key for keep.ts.
// @evidence contracts/testing.md#distinguishing-cases Publish index.ts and keep.ts as the initial source shards. Delete index.ts and publish the resulting source change. Require a reload delta based on the initial generation, deletion of the removed key and retention of the keep key.
// @evidence contracts/testing.md#execution-ownership TestServeShardsDeleteRemovedSource is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsDeleteRemovedSource(t *testing.T) {
  root := graphSessionFixture(t)
  keep := filepath.Join(root, "src", "keep.ts")
  writeGraphFile(t, keep, "export const keep = true;\n")
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  initial, _, _, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  removed := filepath.Join(root, "src", "index.ts")
  removedSource := session.compiler.Program().SourceFile(removed)
  keepSource := session.compiler.Program().SourceFile(keep)
  if removedSource == nil || keepSource == nil {
    t.Fatal("fixture source was absent from resident program")
  }
  removedKeyFile := removedSource.FileName()
  keepKeyFile := keepSource.FileName()
  removedKey := session.graphStore.sourceKeys[removedKeyFile]
  if removedKey == "" {
    t.Fatal("initial generation omitted removable source shard")
  }
  if err := os.Remove(removed); err != nil {
    t.Fatal(err)
  }

  replacement, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if replacement == nil || mode != serveModeReload || !changed || replacement.BaseGeneration != initial.Generation {
    t.Fatalf("replacement generation = snapshot:%#v mode:%q changed:%v", replacement, mode, changed)
  }
  if !containsString(replacement.Deletes, removedKey) {
    t.Fatalf("replacement did not delete removed source shard %q: %v", removedKey, replacement.Deletes)
  }
  if _, exists := session.graphStore.sourceKeys[removedKeyFile]; exists {
    t.Fatal("committed store retained removed source identity")
  }
  if session.graphStore.sourceKeys[keepKeyFile] == "" {
    t.Fatal("replacement generation dropped remaining source")
  }
}
