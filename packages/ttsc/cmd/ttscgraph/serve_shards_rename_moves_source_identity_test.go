package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRenameMovesSourceIdentity verifies a renamed source deletes its
// old shard and publishes a new one whose coordinates name the new path.
//
// A rename is a delete and a create at the filesystem layer but not at the
// resolution layer: the old path can still be imported, and the shard key binds
// the path, so carrying the old identity forward would leave the consumer with
// two coordinates for one declaration. The dependent's import is rewritten in
// the same step, which is what keeps the program resolvable and proves the
// closure covers both ends of the move.
//
//  1. Commit a project whose consumer imports a source by its original path.
//  2. Rename that source and repoint the import in the same generation.
//  3. Require the old shard deleted, a new shard published, and the dependent replaced.
func TestServeShardsRenameMovesSourceIdentity(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  original := filepath.Join(root, "src", "original.ts")
  consumerFile := filepath.Join(root, "src", "consumer.ts")
  writeGraphFile(t, original, "export function moved(): number { return 3; }\n")
  writeGraphFile(t, consumerFile, "import { moved } from './original';\nexport function consume(): number { return moved(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  initial, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if initial == nil || mode != serveModeInitial || !changed {
    t.Fatalf("initial snapshot = snapshot:%v mode:%q changed:%v", initial != nil, mode, changed)
  }
  originalSource := session.compiler.Program().SourceFile(original)
  consumerSource := session.compiler.Program().SourceFile(consumerFile)
  if originalSource == nil || consumerSource == nil {
    t.Fatal("fixture source was absent from resident program")
  }
  originalKeyFile := originalSource.FileName()
  consumerKeyFile := consumerSource.FileName()
  originalKey := session.graphStore.sourceKeys[originalKeyFile]
  initialConsumerKey := session.graphStore.sourceKeys[consumerKeyFile]
  if originalKey == "" || initialConsumerKey == "" {
    t.Fatal("initial generation omitted a fixture source shard")
  }

  renamed := filepath.Join(root, "src", "renamed.ts")
  if err := os.Rename(original, renamed); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, consumerFile, "import { moved } from './renamed';\nexport function consume(): number { return moved(); }\n")

  next, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if next == nil || !changed || next.BaseGeneration != initial.Generation {
    t.Fatalf("rename generation = snapshot:%#v mode:%q changed:%v", next, mode, changed)
  }
  if !containsString(next.Deletes, originalKey) {
    t.Fatalf("rename did not delete the superseded shard %q: %v", originalKey, next.Deletes)
  }
  if _, exists := session.graphStore.sourceKeys[originalKeyFile]; exists {
    t.Fatal("committed store retained the pre-rename source identity")
  }
  renamedSource := session.compiler.Program().SourceFile(renamed)
  if renamedSource == nil {
    t.Fatal("renamed source did not enter the resident program")
  }
  renamedKey := session.graphStore.sourceKeys[renamedSource.FileName()]
  if renamedKey == "" {
    t.Fatal("renamed source did not acquire a committed shard identity")
  }
  if renamedKey == originalKey {
    t.Fatalf("renamed source reused the pre-rename shard key %q", renamedKey)
  }
  if !containsUpsertedShardKey(next, renamedKey) {
    t.Fatalf("generation did not publish the renamed source shard %q", renamedKey)
  }
  nextConsumerKey := session.graphStore.sourceKeys[consumerKeyFile]
  if nextConsumerKey == initialConsumerKey {
    t.Fatalf("dependent shard identity %q survived a repointed import", nextConsumerKey)
  }
}
