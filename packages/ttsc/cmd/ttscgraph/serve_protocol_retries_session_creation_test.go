package main

import (
  "bytes"
  "encoding/json"
  "io"
  "os"
  "path/filepath"
  "testing"
)

// stepReader hands the scanner one scripted chunk per Read call, running each
// step's side effect at the moment the server asks for more input — after the
// previous request has been fully answered.
type stepReader struct {
  steps []func() []byte
  buf   []byte
}

func (r *stepReader) Read(p []byte) (int, error) {
  if len(r.buf) == 0 {
    if len(r.steps) == 0 {
      return 0, io.EOF
    }
    r.buf = r.steps[0]()
    r.steps = r.steps[1:]
  }
  n := copy(p, r.buf)
  r.buf = r.buf[n:]
  return n, nil
}

// TestServeProtocolRetriesSessionCreation verifies a project that is invalid
// at startup answers with an error and recovers on a later request.
//
// The MCP server starts the native process lazily, so the first request may
// hit a broken tsconfig. Failing session creation must stay per-request: the
// server keeps running, and once the config is fixed the same process builds
// the session and serves the initial dump.
//
//  1. Request a snapshot while tsconfig.json is invalid; assert an error.
//  2. Fix the config between requests, request again.
//  3. Assert the second response is a normal initial snapshot.
func TestServeProtocolRetriesSessionCreation(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "tsconfig.json")
  writeGraphFile(t, config, "{ invalid")
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export class Recovered {}\n")

  valid := `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`
  input := &stepReader{steps: []func() []byte{
    func() []byte { return []byte("{\"id\":1}\n") },
    func() []byte {
      if err := os.WriteFile(config, []byte(valid), 0o644); err != nil {
        t.Fatal(err)
      }
      return []byte("{\"id\":2}\n")
    },
  }}
  var output bytes.Buffer

  if code := serveSnapshots(input, &output, root, "tsconfig.json"); code != 0 {
    t.Fatalf("serveSnapshots exited %d", code)
  }
  decoder := json.NewDecoder(&output)
  var failed serveResponse
  var recovered serveResponse
  if err := decoder.Decode(&failed); err != nil {
    t.Fatal(err)
  }
  if err := decoder.Decode(&recovered); err != nil {
    t.Fatal(err)
  }
  if failed.ID != 1 || failed.Error == "" || failed.Dump != nil || failed.Changed {
    t.Fatalf("invalid project response: %#v", failed)
  }
  if recovered.ID != 2 || recovered.Mode != "initial" || !recovered.Changed || recovered.Dump == nil || recovered.Error != "" {
    t.Fatalf("recovered response: %#v", recovered)
  }
  if !hasDumpNode(*recovered.Dump, "Recovered") {
    t.Fatalf("recovered dump omitted the declaration: %#v", recovered.Dump.Nodes)
  }
}
