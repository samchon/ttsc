package main

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"
)

// TestServeProtocolRejectsInvalidRequestLine verifies a malformed NDJSON line
// answers with a protocol error and never poisons the following requests.
//
// The launcher only ever writes well-formed requests, so a garbage line means
// a corrupted pipe or a foreign writer; the server must report it (with the
// zero ID, since none could be parsed) and keep serving instead of exiting.
//
//  1. Send a non-JSON line followed by a valid request.
//  2. Assert the first response carries an error and no dump.
//  3. Assert the second response is the normal initial snapshot.
func TestServeProtocolRejectsInvalidRequestLine(t *testing.T) {
  root := graphSessionFixture(t)
  input := strings.NewReader("not-json\n{\"id\":1}\n")
  var output bytes.Buffer

  if code := serveSnapshots(input, &output, root, "tsconfig.json"); code != 0 {
    t.Fatalf("serveSnapshots exited %d", code)
  }
  decoder := json.NewDecoder(&output)
  var invalid serveResponse
  var initial serveResponse
  if err := decoder.Decode(&invalid); err != nil {
    t.Fatal(err)
  }
  if err := decoder.Decode(&initial); err != nil {
    t.Fatal(err)
  }
  if invalid.ID != 0 || invalid.Error == "" || !strings.Contains(invalid.Error, "invalid request") || invalid.Dump != nil || invalid.Changed {
    t.Fatalf("invalid line response: %#v", invalid)
  }
  if initial.ID != 1 || initial.Mode != "initial" || !initial.Changed || initial.Dump == nil || initial.Error != "" {
    t.Fatalf("follow-up response: %#v", initial)
  }
}
