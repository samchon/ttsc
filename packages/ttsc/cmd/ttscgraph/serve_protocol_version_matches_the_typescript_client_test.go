package main

import (
  "bytes"
  "os"
  "path/filepath"
  "regexp"
  "strconv"
  "testing"
)

// TestServeProtocolVersionMatchesTheTypescriptClient verifies the Go server and
// the TypeScript client agree on the serve protocol version.
//
// The envelope exists in two hand-written places with no generator between them:
// serveResponse here and ITtscGraphSnapshot in @ttsc/graph. Nothing but this
// test makes bumping one a failure until the other follows. That is the whole
// point of the field — a version both sides invent separately detects nothing —
// so the drift it is meant to catch must not be able to start here.
//
//  1. Read PROTOCOL_VERSION out of the TypeScript client's source.
//  2. Compare it to serveProtocolVersion.
func TestServeProtocolVersionMatchesTheTypescriptClient(t *testing.T) {
  client := filepath.Join("..", "..", "..", "graph", "src", "model", "TtscGraphSession.ts")
  source, err := os.ReadFile(client)
  if err != nil {
    t.Fatalf("read the TypeScript client: %v", err)
  }
  // The checkout is CRLF on Windows, and a line-anchored match would never
  // see the end of a line that ends in a carriage return.
  source = bytes.ReplaceAll(source, []byte("\r\n"), []byte("\n"))
  match := regexp.MustCompile(`(?m)^const PROTOCOL_VERSION = (\d+);$`).FindSubmatch(source)
  if match == nil {
    t.Fatalf("no `const PROTOCOL_VERSION = <n>;` in %s; if it moved, this gate must follow it", client)
  }
  declared, err := strconv.Atoi(string(match[1]))
  if err != nil {
    t.Fatalf("PROTOCOL_VERSION is not a number: %v", err)
  }
  if declared != serveProtocolVersion {
    t.Fatalf(
      "serve protocol drifted: Go serves v%d, %s reads v%d",
      serveProtocolVersion,
      client,
      declared,
    )
  }
}
