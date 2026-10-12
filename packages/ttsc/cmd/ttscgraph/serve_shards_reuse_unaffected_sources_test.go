package main

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"
)

// TestServeShardsReuseUnaffectedSources verifies a private body edit advances
// the authored changed source's shard key while the consumer and unrelated
// peer keep their keys and are neither extracted nor upserted. The owner uses
// declaration-shape comparison to select this closure; this unit observes the
// selected files and publication, not declaration output or every public type.
//
//  1. Commit a project where one source has a dependent and an unrelated peer.
//  2. Change only the source's private function body and request another shard snapshot.
//  3. Require one extracted source and no dependent or unrelated shard replacement.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the authored private-body edit changes and upserts the value source key, extracts only that source, and preserves the consumer/unrelated keys without their upserts. The forced declaration output and general public-type equivalence are not independently observed.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over value.ts, a dependent consumer.ts and an unrelated peer: a private body edit must give mode incremental with BaseSequence and BaseGeneration equal to the initial snapshot, a new key for value.ts whose old key is in Deletes, unchanged keys for the other two, exactly one extracted file (value.ts), preserved wire provenance for the unrelated source, and no upsert of the dependent or unrelated key. The test overwrites the unrelated source's physical provenance path with a foreign-looking path to prove the wire path is carried rather than recomputed.
// @evidence contracts/testing.md#distinguishing-cases Commit a project where one source has a dependent and an unrelated peer; Change only the source's private function body and request another shard snapshot; Require one extracted source and no dependent or unrelated shard replacement.
// @evidence contracts/testing.md#execution-ownership TestServeShardsReuseUnaffectedSources is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  initial, mode, changed, err := snapshotGraphShardState(session)
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
  initialValueKey := session.graphStore.sourceKeys[valueKeyFile.AsString()]
  initialConsumerKey := session.graphStore.sourceKeys[consumerKeyFile.AsString()]
  initialUnrelatedKey := session.graphStore.sourceKeys[unrelatedKeyFile.AsString()]
  if initialValueKey == "" || initialConsumerKey == "" || initialUnrelatedKey == "" {
    t.Fatal("initial generation omitted a fixture source key")
  }
  unrelatedWireFile := session.graphStore.wireSources[unrelatedKeyFile.AsString()]
  alteredUnrelatedProvenance := false
  for index := range session.graphStore.provenance.Sources {
    if session.graphStore.provenance.Sources[index].File != unrelatedKeyFile.AsString() {
      continue
    }
    if runtime.GOOS == "windows" {
      volume := "C:"
      if filepath.VolumeName(root) == volume {
        volume = "Z:"
      }
      session.graphStore.provenance.Sources[index].File = volume + "/unrelated.ts"
    } else {
      session.graphStore.provenance.Sources[index].File = "//foreign/share/unrelated.ts"
    }
    alteredUnrelatedProvenance = true
    break
  }
  if unrelatedWireFile == "" || !alteredUnrelatedProvenance {
    t.Fatal("unrelated source was absent from physical/wire provenance")
  }
  if err := os.WriteFile(valueFile, []byte("export function value(): number { return 2; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  delta, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if delta == nil || mode != serveModeIncremental || !changed || delta.BaseSequence != initial.Sequence || delta.BaseGeneration != initial.Generation {
    t.Fatalf("incremental coordinates: snapshot=%#v mode=%q changed=%v", delta, mode, changed)
  }
  nextValueKey := session.graphStore.sourceKeys[valueKeyFile.AsString()]
  if nextValueKey == "" || nextValueKey == initialValueKey {
    t.Fatal("changed source retained its content-addressed shard key")
  }
  if !containsUpsertedShardKey(delta, nextValueKey) {
    t.Fatal("changed source's new shard key was not upserted")
  }
  if !containsString(delta.Deletes, initialValueKey) {
    t.Fatalf("delta did not delete superseded source shard %q: %v", initialValueKey, delta.Deletes)
  }
  if session.graphStore.sourceKeys[consumerKeyFile.AsString()] != initialConsumerKey || session.graphStore.sourceKeys[unrelatedKeyFile.AsString()] != initialUnrelatedKey {
    t.Fatal("body edit moved an unchanged source shard identity")
  }
  if len(session.graphStore.extractedFiles) != 1 || session.graphStore.extractedFiles[0] != valueKeyFile.AsString() {
    t.Fatalf("private body edit extracted %v, want only %s", session.graphStore.extractedFiles, valueKeyFile)
  }
  wireFilePreserved := false
  for _, source := range session.graphStore.wireProvenance.Sources {
    if source.File == unrelatedWireFile {
      wireFilePreserved = true
      break
    }
  }
  if !wireFilePreserved {
    t.Fatalf("unchanged wire provenance lost %q", unrelatedWireFile)
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
