package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsRefreshDependentDiagnostics verifies that the authored public
// return-type edit extracts the producer and unchanged consumer and transmits
// the consumer's new assignment diagnostic in its replacement shard.
//
//  1. Commit a producer and consumer whose public types initially agree.
//  2. Change the producer's exported return type and matching return literal.
//  3. Require both sources to be re-extracted and the new consumer diagnostic
//     to be transmitted in its replacement shard.
//
// @evidence contracts/testing.md#behavioral-verification The authored number-to-string public return-type edit reports incremental and replaces the unchanged consumer's shard with its new assignment diagnostic; the extracted file list is exactly the consumer and producer. Other dependency topologies are not certified.
// @evidence contracts/testing.md#independent-expectations Initial consumer shard identity/digest must exist and have no src/consumer.ts code 2322 diagnostic. After the producer's number-to-string return-type edit, mode must be incremental and changed, the consumer digest must differ and be upserted, and its transmitted shard must contain a src/consumer.ts code 2322 error. Extracted files must be exactly [consumer, value], in that order. The full-projection comparison shares compiler and extraction helpers and cannot independently detect their shared defects.
// @evidence contracts/testing.md#distinguishing-cases Commit a producer and consumer whose public types initially agree; Change the producer's exported return type and matching return literal while leaving the consumer unchanged; Require both sources to be re-extracted and the new consumer diagnostic to be transmitted in its replacement shard.
// @evidence contracts/testing.md#execution-ownership TestServeShardsRefreshDependentDiagnostics is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  consumerSource := session.compiler.Program().SourceFile(consumer)
  if consumerSource == nil {
    t.Fatal("consumer source was absent from resident program")
  }
  consumerKey := session.graphStore.sourceKeys[consumerSource.FileName().AsString()]
  initialConsumer, exists := session.graphStore.shards[consumerKey]
  if consumerKey == "" || !exists || initialConsumer.digest == "" {
    t.Fatal("initial consumer shard has no committed identity or digest")
  }
  before := initialConsumer.digest
  for _, diagnostic := range initialConsumer.shard.Diagnostics {
    if diagnostic.File == "src/consumer.ts" && diagnostic.Code == 2322 {
      t.Fatal("initial number-to-number consumer already has the assignment diagnostic")
    }
  }

  if err := os.WriteFile(value, []byte("export function value(): string { return 'one'; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := snapshotGraphShardState(session)
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
  transmittedAssignmentDiagnostic := false
  for _, upsert := range snapshot.Upserts {
    if upsert.Shard.Key == consumerKey {
      upserted = true
      for _, diagnostic := range upsert.Shard.Diagnostics {
        if diagnostic.File == "src/consumer.ts" && diagnostic.Code == 2322 && diagnostic.Category == "error" {
          transmittedAssignmentDiagnostic = true
        }
      }
      break
    }
  }
  if !upserted {
    t.Fatal("public API edit did not transmit the changed dependent shard")
  }
  if !transmittedAssignmentDiagnostic {
    t.Fatal("replacement consumer shard did not transmit the literal assignment diagnostic")
  }
  valueKeyFile := session.compiler.Program().SourceFile(value).FileName()
  consumerKeyFile := consumerSource.FileName()
  if len(session.graphStore.extractedFiles) != 2 ||
    session.graphStore.extractedFiles[0] != consumerKeyFile.AsString() ||
    session.graphStore.extractedFiles[1] != valueKeyFile.AsString() {
    t.Fatalf(
      "public API edit extracted %v, want reverse closure [%s %s]",
      session.graphStore.extractedFiles,
      consumerKeyFile,
      valueKeyFile,
    )
  }
  assertServeShardFactsMatchFullDump(t, session)
}
