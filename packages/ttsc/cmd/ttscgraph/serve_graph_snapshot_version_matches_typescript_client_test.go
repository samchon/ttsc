package main

import (
  "os"
  "path/filepath"
  "regexp"
  "strconv"
  "testing"
)

// TestServeGraphSnapshotVersionMatchesTypeScriptClient verifies the native
// opt-in number and the resident client move together. The outer serve protocol
// stays backward compatible, so only this explicit negotiation field can stop
// an old full-dump client from misreading a shard response.
func TestServeGraphSnapshotVersionMatchesTypeScriptClient(t *testing.T) {
  source := filepath.Join("..", "..", "..", "graph", "src", "model", "TtscGraphSession.ts")
  content, err := os.ReadFile(source)
  if err != nil {
    t.Fatal(err)
  }
  match := regexp.MustCompile(`const GRAPH_SNAPSHOT_PROTOCOL_VERSION = ([0-9]+);`).FindSubmatch(content)
  if len(match) != 2 {
    t.Fatalf("could not find GRAPH_SNAPSHOT_PROTOCOL_VERSION in %s", source)
  }
  version, err := strconv.Atoi(string(match[1]))
  if err != nil {
    t.Fatal(err)
  }
  if version != graphSnapshotProtocolVersion {
    t.Fatalf("TypeScript client graph snapshot protocol v%d, native server v%d", version, graphSnapshotProtocolVersion)
  }
}
