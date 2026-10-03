package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsAbandonedGenerationConvergesOnRetry verifies discarding a returned snapshot does not prevent later convergence.
//
// Publication commits the producer generation before a client consumes its
// response. A later edit must advance that state again and publish the latest
// source, rather than replaying the snapshot the client discarded.
//
// 1. Commit a generation, edit the source and discard its returned snapshot.
// 2. Edit again and request the snapshot a recovering client would consume.
// 3. Require one advance per publication and the latest Converged source facts.
//
// @evidence contracts/testing.md#behavioral-verification The source state commits each requested publication even when this caller discards a returned snapshot; a later edit converges on the latest source rather than the abandoned text.
// @evidence contracts/testing.md#independent-expectations The literal successive source edits distinguish Abandoned from Converged. The committed sequence must advance once per accepted publication, and the final shard must carry Converged; equality with the discarded facts is not expected.
// @evidence contracts/testing.md#distinguishing-cases Initial publication, a discarded changed response and another source edit distinguish producer commit from client consumption. This direct state case does not simulate a transport cancellation.
// @evidence contracts/testing.md#execution-ownership TestServeShardsAbandonedGenerationConvergesOnRetry is a Go source-unit entry. snapshotGraphShardState calls the actual prepareShardSnapshot transaction and completes each prepared projection, including fallback, with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeShardsAbandonedGenerationConvergesOnRetry(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  committed, _, _, err := snapshotGraphShardState(session)
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
  abandoned, _, changed, err := snapshotGraphShardState(session)
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
  converged, _, changed, err := snapshotGraphShardState(session)
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
