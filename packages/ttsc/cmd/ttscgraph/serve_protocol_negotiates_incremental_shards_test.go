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
func TestServeProtocolNegotiatesIncrementalShards(t *testing.T) {
  root := graphSessionFixture(t)
  input := strings.NewReader("{\"id\":1,\"graphSnapshotVersion\":1}\n{\"id\":2,\"graphSnapshotVersion\":1}\n")
  var output bytes.Buffer
  if code := serveSnapshots(input, &output, root, "tsconfig.json"); code != 0 {
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
