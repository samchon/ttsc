package main

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"
)

// TestServeProtocolReusesSession verifies multiple NDJSON requests share one
// compiler session and unchanged responses omit the full dump.
func TestServeProtocolReusesSession(t *testing.T) {
  root := graphSessionFixture(t)
  input := strings.NewReader("{\"id\":1}\n{\"id\":2}\n")
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
  if initial.ID != 1 || initial.Mode != "initial" || !initial.Changed || initial.Dump == nil {
    t.Fatalf("initial response: %#v", initial)
  }
  if unchanged.ID != 2 || unchanged.Mode != "unchanged" || unchanged.Changed || unchanged.Dump != nil {
    t.Fatalf("unchanged response: %#v", unchanged)
  }
}
