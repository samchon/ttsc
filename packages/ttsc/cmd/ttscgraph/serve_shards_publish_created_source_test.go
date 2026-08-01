package main

import (
  "path/filepath"
  "testing"
)

// TestServeShardsPublishCreatedSource verifies a source that appears while the
// session is resident enters the generation as its own shard and unblocks the
// dependents that could not resolve it before.
//
// Deletion is proven explicitly, but its mirror is the case where a wrong
// closure is invisible: the consumer holds a graph that simply lacks a file,
// and an agent asking about it is told the symbol does not exist rather than
// receiving an error. The dependent must also refresh, because the import that
// previously failed to resolve now produces real cross-file facts.
//
//  1. Commit a project whose consumer imports a module that does not exist yet.
//  2. Create that module and request another shard snapshot.
//  3. Require a shard for the new source and a replaced shard for its dependent.
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
  initial, mode, changed, err := session.SnapshotShards()
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

  next, mode, changed, err := session.SnapshotShards()
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
  // The dependent's import resolved for the first time, so its cross-file facts
  // changed even though its own text did not. Reusing its prior shard would
  // publish a consumer graph with a call edge to nothing.
  nextConsumerKey := session.graphStore.sourceKeys[consumerKeyFile]
  if nextConsumerKey == initialConsumerKey {
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
