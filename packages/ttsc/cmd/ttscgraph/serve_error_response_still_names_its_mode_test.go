package main

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestServeErrorResponseStillNamesItsMode verifies a failed snapshot answers
// with a mode and a protocol version rather than dropping them.
//
// This is the negative twin of the successful snapshot. Mode used to be
// omitempty, so it vanished on exactly the path where a consumer most needs to
// say what happened: the error path serves no dump and set no mode, leaving
// "what did the compiler do" unanswerable and the field unrelied-upon. A field
// that is present only when things go well is not a field a consumer can branch
// on.
//
//  1. Serve a project whose tsconfig is invalid, so the session cannot be built.
//  2. Assert the response carries the error, and mode is the error mode.
//  3. Assert the protocol version still rides it, so the client can read it at
//     all.
func TestServeErrorResponseStillNamesItsMode(t *testing.T) {
  root := graphSessionFixture(t)
  if err := os.WriteFile(filepath.Join(root, "tsconfig.json"), []byte("{ invalid"), 0o644); err != nil {
    t.Fatal(err)
  }

  var output bytes.Buffer
  if code := serveSnapshots(strings.NewReader("{\"id\":7}\n"), &output, root, "tsconfig.json"); code != 0 {
    t.Fatalf("serveSnapshots exited %d", code)
  }
  // Keep the bytes: they are read twice below, once as the typed envelope and
  // once as bare keys, and a decoder would drain the buffer before the second.
  line := output.Bytes()
  var response serveResponse
  if err := json.Unmarshal(line, &response); err != nil {
    t.Fatal(err)
  }
  if response.Error == "" {
    t.Fatalf("invalid config produced no error: %#v", response)
  }
  if response.ID != 7 {
    t.Fatalf("error response id %d, want the request's 7", response.ID)
  }
  if response.Mode != serveModeError {
    t.Fatalf("error response mode %q, want %q", response.Mode, serveModeError)
  }
  if response.ProtocolVersion != serveProtocolVersion {
    t.Fatalf("error response protocol version %d, want %d", response.ProtocolVersion, serveProtocolVersion)
  }
  if response.Dump != nil {
    t.Fatal("error response carried a dump")
  }
  if response.Changed {
    t.Fatal("error response claimed the graph changed")
  }

  // The wire keys, not the Go fields: mode must survive serialization, which is
  // the whole regression — omitempty dropped it there and nowhere else.
  var raw map[string]any
  if err := json.Unmarshal(line, &raw); err != nil {
    t.Fatal(err)
  }
  for _, key := range []string{"mode", "protocolVersion", "capabilities"} {
    if _, ok := raw[key]; !ok {
      t.Fatalf("error response omitted %q on the wire: %s", key, line)
    }
  }
}
