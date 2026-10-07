package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRenameMovesSourceIdentity verifies a renamed source deletes its
// old shard key and upserts a different key mapped to the new resident path.
//
// The consumer import is rewritten with the rename, and its committed key must
// change. This unit observes resident-path membership and shard-key changes;
// it does not inspect wire coordinate text, consumer upsert payloads, actual
// resolution diagnostics, or consumer application of the move.
//
//  1. Commit a project whose consumer imports a source by its original path.
//  2. Rename that source and repoint the import in the same generation.
//  3. Require the old shard deleted, a new shard upserted, and the consumer's committed key changed.
//
// @evidence contracts/testing.md#behavioral-verification Verifies explicit deletion of the original shard key, resident membership and an upserted different key for the renamed source, and a nonempty changed consumer key. Wire coordinate text, consumer upsert payloads, and actual resolution diagnostics are not asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a consumer importing ./original: after renaming it to renamed.ts and repointing the import, the snapshot must be changed with BaseGeneration equal to the initial generation, Deletes must contain the old shard key, the store must drop the old source identity, the renamed source must hold a new, upserted shard key different from the old one, and the consumer's shard key must change. The test does not assert the new shard's coordinates text.
// @evidence contracts/testing.md#distinguishing-cases Commit a project whose consumer imports a source by its original path; Rename that source and repoint the import in the same generation; Require the old shard deleted, a new shard upserted, and the consumer's committed key changed.
// @evidence contracts/testing.md#execution-ownership TestServeShardsRenameMovesSourceIdentity is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  initial, mode, changed, err := snapshotGraphShardState(session)
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

  next, mode, changed, err := snapshotGraphShardState(session)
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
  if nextConsumerKey == "" || nextConsumerKey == initialConsumerKey {
    t.Fatalf("dependent shard identity %q survived a repointed import", nextConsumerKey)
  }
}
