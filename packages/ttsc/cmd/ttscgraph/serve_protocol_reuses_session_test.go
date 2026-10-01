package main

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"
)

// TestServeProtocolReusesSession verifies multiple NDJSON requests share one
// compiler session and unchanged responses omit the full dump.
//
// 1. Load the resident fixture and submit requests with IDs one and two.
// 2. Decode both responses from one NDJSON operation.
// 3. Require an initial changed dump for ID one and unchanged with no dump for ID two.
//
// @evidence contracts/testing.md#behavioral-verification Require an initial changed dump for ID one and unchanged with no dump for ID two.
// @evidence contracts/testing.md#independent-expectations The literal fixture and supported graph contract establish these expectations: Require an initial changed dump for ID one and unchanged with no dump for ID two.
// @evidence contracts/testing.md#distinguishing-cases Load the resident fixture and submit requests with IDs one and two. Decode both responses from one NDJSON operation. Require an initial changed dump for ID one and unchanged with no dump for ID two.
// @evidence contracts/testing.md#execution-ownership TestServeProtocolReusesSession is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeProtocolReusesSession(t *testing.T) {
  root := graphSessionFixture(t)
  input := strings.NewReader("{\"id\":1}\n{\"id\":2}\n")
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
  if initial.ID != 1 || initial.Mode != "initial" || !initial.Changed || initial.Dump == nil {
    t.Fatalf("initial response: %#v", initial)
  }
  if unchanged.ID != 2 || unchanged.Mode != "unchanged" || unchanged.Changed || unchanged.Dump != nil {
    t.Fatalf("unchanged response: %#v", unchanged)
  }
}
