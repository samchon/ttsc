package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRefreshDependentDiagnostics proves a public API edit rebuilds
// the reverse semantic closure. The dependent source text is unchanged while
// its checker diagnostic changes, so reusing that shard would be stale.
func TestServeShardsRefreshDependentDiagnostics(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  value := filepath.Join(root, "src", "value.ts")
  consumer := filepath.Join(root, "src", "consumer.ts")
  writeGraphFile(t, value, "export function value(): number { return 1; }\n")
  writeGraphFile(t, consumer, "import { value } from './value';\nexport const consumed: number = value();\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := session.SnapshotShards(); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  consumerSource := session.compiler.Program().SourceFile(consumer)
  if consumerSource == nil {
    t.Fatal("consumer source was absent from resident program")
  }
  consumerKey := session.graphStore.sourceKeys[consumerSource.FileName()]
  before := session.graphStore.shards[consumerKey].digest

  if err := os.WriteFile(value, []byte("export function value(): string { return 'one'; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if snapshot == nil || mode != serveModeIncremental || !changed {
    t.Fatalf("public API edit = snapshot:%v mode:%q changed:%v", snapshot != nil, mode, changed)
  }
  after := session.graphStore.shards[consumerKey].digest
  if after == before {
    t.Fatal("dependent diagnostic retained its previous shard digest")
  }
  upserted := false
  for _, upsert := range snapshot.Upserts {
    if upsert.Shard.Key == consumerKey {
      upserted = true
      break
    }
  }
  if !upserted {
    t.Fatal("public API edit did not transmit the changed dependent shard")
  }
  assertServeShardFactsMatchFullDump(t, session)
}
