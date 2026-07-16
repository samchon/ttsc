package main

import (
  "bytes"
  "crypto/sha256"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeSnapshotProvesItsProgramWithoutASecondRead verifies a single serve
// response carries everything needed to prove which program produced it.
//
// This is the contract the envelope exists for. A consumer used to be handed
// paths and nothing else, so proving that the nodes, edges, and the file bytes
// it was about to read all belonged to one Program meant re-reading the disk
// afterwards and asking the server a second time whether anything had moved —
// which narrows the race without closing it, and never proves the bytes read are
// the bytes the checker resolved against. Everything below has to come out of
// one frame, because a second frame is the thing being replaced.
//
//  1. Take one snapshot of a fixture project.
//  2. Assert the envelope names its protocol, mode, and capabilities.
//  3. Assert every file the dump names carries a digest, and that hashing the
//     file off the disk independently reproduces it.
func TestServeSnapshotProvesItsProgramWithoutASecondRead(t *testing.T) {
  root := graphSessionFixture(t)
  var output bytes.Buffer
  if code := serveSnapshots(strings.NewReader("{\"id\":1}\n"), &output, root, "tsconfig.json"); code != 0 {
    t.Fatalf("serveSnapshots exited %d", code)
  }

  var response serveResponse
  if err := json.NewDecoder(&output).Decode(&response); err != nil {
    t.Fatal(err)
  }
  if response.Error != "" {
    t.Fatalf("snapshot failed: %s", response.Error)
  }
  if response.ProtocolVersion != serveProtocolVersion {
    t.Fatalf("envelope protocol version %d, want %d", response.ProtocolVersion, serveProtocolVersion)
  }
  if response.Mode != serveModeInitial {
    t.Fatalf("mode %q, want %q", response.Mode, serveModeInitial)
  }
  if len(response.Capabilities) == 0 {
    t.Fatal("envelope declared no capabilities, so a consumer cannot tell what it may rely on")
  }
  if response.Dump == nil {
    t.Fatal("initial snapshot carried no dump")
  }

  provenance := response.Dump.Provenance
  if provenance.SchemaVersion != graph.DumpSchemaVersion {
    t.Fatalf("dump schema version %d, want %d", provenance.SchemaVersion, graph.DumpSchemaVersion)
  }
  if provenance.Producer.Typescript == "" {
    t.Fatal("provenance did not name the TypeScript version behind the facts")
  }
  if len(provenance.Universe.Configs) == 0 {
    t.Fatal("universe fingerprinted no config, though the fixture has a tsconfig")
  }
  if len(provenance.Universe.Roots) == 0 {
    t.Fatal("universe fingerprinted no root file")
  }

  // Every file a node names must appear in the manifest. A file with facts but
  // no digest is exactly the gap the manifest closes: a consumer would have to
  // trust it.
  digests := make(map[string]graph.SourceDigest, len(provenance.Sources))
  for _, source := range provenance.Sources {
    digests[source.File] = source
  }
  for _, node := range response.Dump.Nodes {
    if node.External {
      continue
    }
    if _, ok := digests[node.File]; !ok {
      t.Fatalf("node %q names file %q, which the manifest does not digest", node.ID, node.File)
    }
  }

  // The point of the disk digest: a consumer that opens the file itself can
  // reproduce it. Do exactly that, from outside the compiler.
  proven := 0
  for file, source := range digests {
    if source.Disk == "" {
      continue
    }
    content, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(file)))
    if err != nil {
      continue
    }
    if got := graph.Digest(sha256.Sum256(content)); got != source.Disk {
      t.Fatalf("independent read of %q hashes to %s, manifest says %s", file, got, source.Disk)
    }
    proven++
  }
  if proven == 0 {
    t.Fatal("no file's digest could be reproduced from disk, so the manifest proves nothing")
  }
}
