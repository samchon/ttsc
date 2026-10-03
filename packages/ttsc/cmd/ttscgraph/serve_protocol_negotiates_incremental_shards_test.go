package main

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"
)

// TestServeProtocolNegotiatesIncrementalShards pins the opt-in boundary between
// existing full-dump clients and the native shard protocol. A negotiated first
// response carries one complete manifest and transaction, while the following
// no-op carries neither a dump nor a shard payload. Completeness here means
// structural correspondence of manifest keys and upserts, not independent
// authentication of the graph facts or digest bytes.
//
// 1. Submit protocol version one requests over a real resident source fixture.
// 2. Read the initial shard envelope and then the unchanged response from the NDJSON operation.
// 3. Require initial sequence one, base zero, a complete nonempty manifest and matching upserts with no deletes or legacy dump; require no unchanged payload.
//
// @evidence contracts/testing.md#behavioral-verification With graphSnapshotVersion 1 the real NDJSON serve loop answers the first request with a complete shard transaction (sequence 1, base 0, non-empty manifest, one upsert per manifest entry, no deletes, no legacy dump) and answers the second with an unchanged response carrying neither dump nor snapshot.
// @evidence contracts/testing.md#independent-expectations The shard contract supplies literal sequence 1, base sequence 0, empty base generation and no deletes. Each nonempty unique manifest key must have exactly one upsert with the same digest, rather than merely an equal count. The unedited second request must be unchanged without payload. Digest bytes and completeness of semantic graph facts are not independently authenticated.
// @evidence contracts/testing.md#distinguishing-cases Submit protocol version one requests over a real resident source fixture. Read the initial shard envelope and then the unchanged response from the NDJSON operation. Require initial sequence one, base zero, a complete nonempty manifest and matching upserts with no deletes or legacy dump; require no unchanged payload.
// @evidence contracts/testing.md#execution-ownership TestServeProtocolNegotiatesIncrementalShards is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeProtocolNegotiatesIncrementalShards(t *testing.T) {
  root := graphSessionFixture(t)
  input := strings.NewReader("{\"id\":1,\"graphSnapshotVersion\":1}\n{\"id\":2,\"graphSnapshotVersion\":1}\n")
  var output bytes.Buffer
  if code := serveSourceSnapshots(input, &output, root, "tsconfig.json"); code != 0 {
    t.Fatalf("serveSnapshots exited %d", code)
  }

  decoder := json.NewDecoder(&output)
  var initial serveResponse
  var unchanged serveResponse
  if err := decoder.Decode(&initial); err != nil {
    t.Fatal(err)
  }
  if err := decoder.Decode(&unchanged); err != nil {
    t.Fatal(err)
  }
  if initial.Error != "" || initial.Mode != serveModeInitial || !initial.Changed || initial.Dump != nil || initial.Snapshot == nil {
    t.Fatalf("negotiated initial response: %#v", initial)
  }
  snapshot := initial.Snapshot
  if snapshot.ProtocolVersion != graphSnapshotProtocolVersion || snapshot.Sequence != 1 || snapshot.BaseSequence != 0 || snapshot.BaseGeneration != "" {
    t.Fatalf("initial transaction coordinates: %#v", snapshot)
  }
  if len(snapshot.Manifest) == 0 || len(snapshot.Upserts) != len(snapshot.Manifest) || len(snapshot.Deletes) != 0 {
    t.Fatalf("initial transaction is not complete: manifest=%d upserts=%d deletes=%d", len(snapshot.Manifest), len(snapshot.Upserts), len(snapshot.Deletes))
  }
  manifest := map[string]string{}
  for _, entry := range snapshot.Manifest {
    if entry.Key == "" || entry.Digest == "" {
      t.Fatalf("initial manifest has an empty key or digest: %#v", entry)
    }
    if _, exists := manifest[entry.Key]; exists {
      t.Fatalf("initial manifest repeats key %q", entry.Key)
    }
    manifest[entry.Key] = entry.Digest
  }
  seen := map[string]bool{}
  for _, upsert := range snapshot.Upserts {
    key := upsert.Shard.Key
    digest, exists := manifest[key]
    if !exists || seen[key] || upsert.Digest != digest {
      t.Fatalf("initial upsert does not uniquely match its manifest entry: %#v", upsert)
    }
    seen[key] = true
  }
  for key := range manifest {
    if !seen[key] {
      t.Fatalf("initial transaction omits manifest key %q", key)
    }
  }
  if unchanged.Error != "" || unchanged.Mode != serveModeUnchanged || unchanged.Changed || unchanged.Dump != nil || unchanged.Snapshot != nil {
    t.Fatalf("negotiated unchanged response: %#v", unchanged)
  }
}
