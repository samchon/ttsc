package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "path/filepath"
  "testing"
)

// TestServeAdoptsARepublishedSetOverTheShardProtocol verifies artifact replacement reaches the negotiated shard response.
//
// Legacy dumps and shard publications share invalidation but use different
// projection and response shapes. A shard refresh must also replace the source
// shard whose citation names the changed document address.
//
// 1. Negotiate version-one shards and publish the Pricing artifact.
// 2. Name the replacement Discounts set in the next request.
// 3. Require rebuild shards with only the replacement artifact and citing source.
//
// @evidence contracts/testing.md#behavioral-verification The actual NDJSON shard operation replaces the artifact node and re-emits its citing source shard when the named artifact set changes.
// @evidence contracts/testing.md#independent-expectations Literal pricing and discounts addresses identify the old and new artifact facts. The authored source cites that address, so retaining its old shard would retain a stale edge; the replacement must include src/index.ts.
// @evidence contracts/testing.md#distinguishing-cases Initial negotiated shards contrast a republished set requiring rebuild, old-node removal, new-node retention and re-emission of the citing source. The separate legacy case owns full-dump response semantics.
// @evidence contracts/testing.md#execution-ownership TestServeAdoptsARepublishedSetOverTheShardProtocol is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeAdoptsARepublishedSetOverTheShardProtocol(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  // The declaration cites the artifact, so the edge to it lives in this
  // source's own shard while the artifact node lands in the metadata shard.
  // Both have to move together: a snapshot that replaced the artifact and left
  // this shard alone would leave the client holding an edge into an address
  // nothing publishes any more.
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"),
    "/** @evidence docs/sale.md#pricing States the rule. */\nexport class Priced {}\n")
  published := t.TempDir()
  first := filepath.Join(published, "first.json")
  second := filepath.Join(published, "second.json")
  writeArtifactSet(t, first, "docs/sale.md#pricing", "Pricing")
  writeArtifactSet(t, second, "docs/sale.md#discounts", "Discounts")

  var output bytes.Buffer
  code := serveSourceSnapshotsWithArtifacts(
    bytes.NewReader([]byte(fmt.Sprintf(
      "{\"id\":1,\"graphSnapshotVersion\":%d,\"artifacts\":%s}\n{\"id\":2,\"graphSnapshotVersion\":%d,\"artifacts\":%s}\n",
      graphSnapshotProtocolVersion,
      mustJSONString(t, first),
      graphSnapshotProtocolVersion,
      mustJSONString(t, second),
    ))),
    &output,
    root,
    "tsconfig.json",
    nil,
  )
  if code != 0 {
    t.Fatalf("serveSnapshotsWithArtifacts exited %d: %s", code, output.String())
  }

  decoder := json.NewDecoder(&output)
  var initial serveResponse
  var republished serveResponse
  if err := decoder.Decode(&initial); err != nil {
    t.Fatal(err)
  }
  if err := decoder.Decode(&republished); err != nil {
    t.Fatal(err)
  }
  if initial.Snapshot == nil {
    t.Fatalf("the shard protocol was not negotiated: %#v", initial)
  }
  if !shardsCarryArtifact(initial.Snapshot, "docs/sale.md#pricing") {
    t.Fatal("the initial shard snapshot does not carry the artifact its request named")
  }
  if republished.Mode != serveModeRebuild || republished.Snapshot == nil {
    t.Fatalf("a republished set over the shard protocol answered %#v", republished)
  }
  if !shardsCarryArtifact(republished.Snapshot, "docs/sale.md#discounts") {
    t.Fatal("the republished shard snapshot does not carry the artifact that replaced the old one")
  }
  if shardsCarryArtifact(republished.Snapshot, "docs/sale.md#pricing") {
    t.Fatal("the republished shard snapshot still carries the withdrawn artifact")
  }
  // The citing source's shard has to come with it, whichever projection the
  // session chose. Its edges name the address that just moved, so a client left
  // holding the previous version of this shard holds a dangling one.
  if !shardsCarrySource(republished.Snapshot, "src/index.ts") {
    t.Fatal("the shard owning the citing declaration was not re-emitted, so its edge to the withdrawn address survives in the client")
  }
}
