package main

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"
)

// TestServeProtocolReusesSession verifies initial then unchanged responses on
// one NDJSON stream, with no dump on the unchanged response. It observes the
// reported reuse behavior, not compiler-construction counts or object identity.
//
// 1. Load the resident fixture and submit requests with IDs one and two.
// 2. Decode both responses from one NDJSON operation.
// 3. Require an initial changed dump for ID one and unchanged with no dump for ID two.
//
// @evidence contracts/testing.md#behavioral-verification On one NDJSON stream, id 1 reports initial with a changed dump and id 2 over unedited sources reports unchanged, not changed and no dump. The assertions own these response distinctions; they do not observe compiler-construction counts or session object identity.
// @evidence contracts/testing.md#independent-expectations Literal serve-contract modes initial then unchanged, IDs 1 and 2, and the second response's absent dump are independent expected outcomes for the unedited fixture. Repeating an initial response or returning a dump on unchanged fails. A hidden reconstruction that preserved all these responses would remain indistinguishable.
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
