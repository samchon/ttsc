package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsAbandonedGenerationConvergesOnRetry verifies a consumer that
// abandons a request mid-flight can still converge, and that the facts it
// eventually commits match the ones it discarded.
//
// The producer has no abort path: it commits after the projection succeeds, so
// a client that walks away leaves the producer's committed generation ahead of
// the consumer's. Cancellation is therefore discharged by base negotiation
// rather than by cancellation handling, which is sound only if the abandoned
// generation is not the sole carrier of its facts. A consumer replaying from
// its own stale base has to receive those same facts again.
//
//  1. Commit one generation, then edit and take a generation the client discards.
//  2. Edit again and take the generation a recovered client would actually read.
//  3. Require the store to have advanced once per accepted call and the final
//     shard for the edited source to carry the latest text, not the abandoned one.
func TestServeShardsAbandonedGenerationConvergesOnRetry(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  committed, _, _, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  file := filepath.Join(root, "src", "index.ts")
  indexSource := session.compiler.Program().SourceFile(file)
  if indexSource == nil {
    t.Fatal("fixture source was absent from resident program")
  }
  indexKeyFile := indexSource.FileName()

  // The generation the client asks for and then abandons before reading.
  if err := os.WriteFile(file, []byte("export class Abandoned {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  abandoned, _, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if abandoned == nil || !changed || abandoned.BaseGeneration != committed.Generation {
    t.Fatalf("abandoned generation = snapshot:%#v changed:%v", abandoned, changed)
  }
  abandonedKey := session.graphStore.sourceKeys[indexKeyFile]

  // The producer moved on regardless. A later edit plus the client's retry has
  // to publish a generation that supersedes the abandoned one rather than
  // depending on the consumer having applied it.
  if err := os.WriteFile(file, []byte("export class Converged {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  converged, _, changed, err := session.SnapshotShards()
  if err != nil {
    t.Fatal(err)
  }
  if converged == nil || !changed {
    t.Fatalf("converged generation = snapshot:%#v changed:%v", converged, changed)
  }
  if converged.BaseGeneration != abandoned.Generation {
    t.Fatalf(
      "converged base = %q, want the abandoned generation %q the producer actually committed",
      converged.BaseGeneration,
      abandoned.Generation,
    )
  }
  if converged.Sequence != abandoned.Sequence+1 {
    t.Fatalf("converged sequence = %d, want %d", converged.Sequence, abandoned.Sequence+1)
  }
  convergedKey := session.graphStore.sourceKeys[indexKeyFile]
  if convergedKey == "" || convergedKey == abandonedKey {
    t.Fatalf("edited source kept the abandoned shard identity %q", convergedKey)
  }
  if !containsUpsertedShardKey(converged, convergedKey) {
    t.Fatalf("converged generation did not publish the latest shard %q", convergedKey)
  }
  if !containsString(converged.Deletes, abandonedKey) {
    t.Fatalf(
      "converged generation did not supersede the abandoned shard %q: %v",
      abandonedKey,
      converged.Deletes,
    )
  }
}
