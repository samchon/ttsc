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
// no-op carries neither a dump nor a shard payload.
//
// 1. Submit protocol version one requests over a real resident source fixture.
// 2. Read the initial shard envelope and then the unchanged response from the NDJSON operation.
// 3. Require initial sequence one, base zero, a complete nonempty manifest and matching upserts with no deletes or legacy dump; require no unchanged payload.
//
// @evidence contracts/testing.md#behavioral-verification Require initial sequence one, base zero, a complete nonempty manifest and matching upserts with no deletes or legacy dump; require no unchanged payload.
// @evidence contracts/testing.md#independent-expectations The literal fixture and the supported graph contract establish these expectations: Require initial sequence one, base zero, a complete nonempty manifest and matching upserts with no deletes or legacy dump; require no unchanged payload.
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
  if unchanged.Error != "" || unchanged.Mode != serveModeUnchanged || unchanged.Changed || unchanged.Dump != nil || unchanged.Snapshot != nil {
    t.Fatalf("negotiated unchanged response: %#v", unchanged)
  }
}
