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
// @evidence contracts/testing.md#behavioral-verification Actual NDJSON shard publication initially includes the pricing artifact and one pricing doc_ref in src/index.ts. Replacement publishes Discounts without Pricing and re-emits src/index.ts without a pricing or discounts doc_ref: its unchanged authored tag still names the withdrawn pricing address.
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
  initialSources, initialCitations := 0, 0
  for _, upsert := range initial.Snapshot.Upserts {
    if upsert.Shard.Source == nil || upsert.Shard.Source.File != "src/index.ts" {
      continue
    }
    initialSources++
    for _, edge := range upsert.Shard.Edges {
      if edge.Kind == "doc_ref" && edge.To == "docs/sale.md#pricing" {
        initialCitations++
      }
    }
  }
  if initialSources != 1 || initialCitations != 1 {
    t.Fatalf("initial source/citation counts = %d/%d, want 1/1", initialSources, initialCitations)
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
  republishedSources := 0
  for _, upsert := range republished.Snapshot.Upserts {
    if upsert.Shard.Source == nil || upsert.Shard.Source.File != "src/index.ts" {
      continue
    }
    republishedSources++
    for _, edge := range upsert.Shard.Edges {
      if edge.Kind == "doc_ref" && (edge.To == "docs/sale.md#pricing" || edge.To == "docs/sale.md#discounts") {
        t.Errorf("unchanged pricing tag retained or acquired an unresolved citation edge: %+v", edge)
      }
    }
  }
  if republishedSources != 1 {
    t.Fatalf("republished source count = %d, want 1", republishedSources)
  }
}
