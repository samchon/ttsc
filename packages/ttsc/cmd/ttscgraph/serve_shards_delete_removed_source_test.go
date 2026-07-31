package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsDeleteRemovedSource verifies a root-set reload names the
// superseded source shard explicitly while publishing a complete replacement
// generation. A consumer never has to infer deletion from a missing payload.
func TestServeShardsDeleteRemovedSource(t *testing.T) {
  root := graphSessionFixture(t)
  keep := filepath.Join(root, "src", "keep.ts")
  writeGraphFile(t, keep, "export const keep = true;\n")
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  initial, _, _, err := session.SnapshotShards()
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

  replacement, mode, changed, err := session.SnapshotShards()
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
