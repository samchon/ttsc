package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsReuseUnaffectedSources verifies a private body edit advances
// only the changed content-addressed source shard on the wire. The compiler's
// reference closure is rebuilt for correctness, but byte-identical dependent
// and unrelated shards remain in the committed manifest without retransmission.
func TestServeShardsReuseUnaffectedSources(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "value.ts"), "export function value(): number { return 1; }\n")
  writeGraphFile(t, filepath.Join(root, "src", "consumer.ts"), "import { value } from './value';\nexport function consume(): number { return value(); }\n")
  writeGraphFile(t, filepath.Join(root, "src", "unrelated.ts"), "export const unrelated = true;\n")

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
  valueFile := filepath.Join(root, "src", "value.ts")
  consumerFile := filepath.Join(root, "src", "consumer.ts")
  unrelatedFile := filepath.Join(root, "src", "unrelated.ts")
  valueSource := session.compiler.Program().SourceFile(valueFile)
  consumerSource := session.compiler.Program().SourceFile(consumerFile)
  unrelatedSource := session.compiler.Program().SourceFile(unrelatedFile)
  if valueSource == nil || consumerSource == nil || unrelatedSource == nil {
    t.Fatal("fixture source was absent from resident program")
  }
  valueKeyFile := valueSource.FileName()
  consumerKeyFile := consumerSource.FileName()
  unrelatedKeyFile := unrelatedSource.FileName()
  initialValueKey := session.graphStore.sourceKeys[valueKeyFile]
  initialConsumerKey := session.graphStore.sourceKeys[consumerKeyFile]
  initialUnrelatedKey := session.graphStore.sourceKeys[unrelatedKeyFile]
  if err := os.WriteFile(valueFile, []byte("export function value(): number { return 2; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  delta, mode, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if delta == nil || mode != serveModeIncremental || !changed || delta.BaseSequence != initial.Sequence || delta.BaseGeneration != initial.Generation {
    t.Fatalf("incremental coordinates: snapshot=%#v mode=%q changed=%v", delta, mode, changed)
  }
  nextValueKey := session.graphStore.sourceKeys[valueKeyFile]
  if nextValueKey == initialValueKey {
    t.Fatal("changed source retained its content-addressed shard key")
  }
  if !containsString(delta.Deletes, initialValueKey) {
    t.Fatalf("delta did not delete superseded source shard %q: %v", initialValueKey, delta.Deletes)
  }
  if session.graphStore.sourceKeys[consumerKeyFile] != initialConsumerKey || session.graphStore.sourceKeys[unrelatedKeyFile] != initialUnrelatedKey {
    t.Fatal("body edit moved an unchanged source shard identity")
  }
  for _, upsert := range delta.Upserts {
    if upsert.Shard.Key == initialConsumerKey || upsert.Shard.Key == initialUnrelatedKey {
      t.Fatalf("delta retransmitted byte-identical shard %q", upsert.Shard.Key)
    }
  }
}

func containsString(values []string, expected string) bool {
  for _, value := range values {
    if value == expected {
      return true
    }
  }
  return false
}
