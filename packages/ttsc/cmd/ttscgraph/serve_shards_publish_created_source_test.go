package main

import (
  "path/filepath"
  "testing"
)

// TestServeShardsPublishCreatedSource verifies a source that appears while the
// session is resident enters the generation as its own shard and the authored
// consumer acquires a changed shard key that is also upserted.
//
// This is the source-creation counterpart to deletion: freshness must publish
// the new source and refresh its consumer. This unit observes resident source
// membership and shard identities, not resolution diagnostics, cross-file call
// edges, or downstream consumer queries.
//
//  1. Commit a project whose consumer imports a module that does not exist yet.
//  2. Create that module and request another shard snapshot.
//  3. Require a shard for the new source and a replaced shard for its dependent.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the authored new source enters the resident program and acquires an upserted shard key, while the consumer's nonempty key changes and is upserted. Actual call edges, diagnostic disappearance, and downstream consumer queries are not asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a consumer that imports a not-yet-existing ./later: after src/later.ts is created, the snapshot must be changed with BaseGeneration equal to the initial generation, the new source must hold a committed shard key that is upserted, and the consumer's shard key must differ from its initial key and be upserted, because its import newly resolved. The snapshot mode is not asserted.
// @evidence contracts/testing.md#distinguishing-cases Commit a project whose consumer imports a module that does not exist yet; Create that module and request another shard snapshot; Require a shard for the new source and a replaced shard for its dependent.
// @evidence contracts/testing.md#execution-ownership TestServeShardsPublishCreatedSource is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsPublishCreatedSource(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  consumerFile := filepath.Join(root, "src", "consumer.ts")
  writeGraphFile(t, consumerFile, "import { later } from './later';\nexport function consume(): number { return later(); }\n")

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
  consumerSource := session.compiler.Program().SourceFile(consumerFile)
  if consumerSource == nil {
    t.Fatal("fixture source was absent from resident program")
  }
  consumerKeyFile := consumerSource.FileName()
  initialConsumerKey := session.graphStore.sourceKeys[consumerKeyFile]
  if initialConsumerKey == "" {
    t.Fatal("initial generation omitted the dependent source shard")
  }

  createdFile := filepath.Join(root, "src", "later.ts")
  writeGraphFile(t, createdFile, "export function later(): number { return 7; }\n")

  next, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if next == nil || !changed || next.BaseGeneration != initial.Generation {
    t.Fatalf("created-source generation = snapshot:%#v mode:%q changed:%v", next, mode, changed)
  }
  createdSource := session.compiler.Program().SourceFile(createdFile)
  if createdSource == nil {
    t.Fatal("created source did not enter the resident program")
  }
  createdKey := session.graphStore.sourceKeys[createdSource.FileName()]
  if createdKey == "" {
    t.Fatal("created source did not acquire a committed shard identity")
  }
  if !containsUpsertedShardKey(next, createdKey) {
    t.Fatalf("generation did not publish the created source shard %q", createdKey)
  }
  // The unchanged consumer text must acquire a different published shard key;
  // the call-edge contents are not independently checked here.
  nextConsumerKey := session.graphStore.sourceKeys[consumerKeyFile]
  if nextConsumerKey == "" || nextConsumerKey == initialConsumerKey {
    t.Fatalf("dependent shard identity %q survived a newly resolved import", nextConsumerKey)
  }
  if !containsUpsertedShardKey(next, nextConsumerKey) {
    t.Fatalf("generation did not republish the dependent shard %q", nextConsumerKey)
  }
}

func containsUpsertedShardKey(snapshot *serveGraphSnapshot, expected string) bool {
  for _, upsert := range snapshot.Upserts {
    if upsert.Shard.Key == expected {
      return true
    }
  }
  return false
}
