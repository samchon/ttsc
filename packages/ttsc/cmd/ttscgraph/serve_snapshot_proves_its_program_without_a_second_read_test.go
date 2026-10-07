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
// response carries the authored metadata and source-manifest memberships,
// with supplied disk digests reproducible from the untouched fixture.
//
// One request supplies the observed protocol, mode, capabilities, producer,
// config/root memberships and node-file source entries. Independent native
// reads reproduce its nonempty disk digests without another server request.
// This does not authenticate a Program object, verify checker-text digests,
// establish graph-fact semantics, or close races with later external edits.
//
//  1. Take one snapshot of a fixture project.
//  2. Assert the envelope names its protocol, mode, and capabilities.
//  3. Require non-external node files in the source manifest and independently
//     reproduce every supplied nonempty disk digest, including at least one.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the observed metadata and source-manifest memberships in one serve response and independently reproduces its nonempty disk digests over the untouched fixture. The same supplied generation also requires two native same-file spellings to share one wire source while retaining both raw owners; different checker, disk and absent disk witnesses must fail. Program authentication, checker-text hashes, graph semantics, and external-edit races are not certified.
// @evidence contracts/testing.md#independent-expectations The expectations are literal contract values plus an independent hash: the envelope must carry serveProtocolVersion, mode initial, a non-empty capability list and a dump whose provenance names producer ttscgraph, a TypeScript version, at least one config and one root; every non-external node's file must appear in the digest manifest; and, for every manifest entry with a disk digest, SHA-256 of the file read from disk by the test must equal it (at least one must be reproduced). A manifest that omitted files or carried digests the bytes do not reproduce fails.
// @evidence contracts/testing.md#distinguishing-cases Take one snapshot of an untouched fixture; Assert the envelope metadata and source-manifest memberships; Independently reproduce supplied nonempty disk digests, including at least one, without another server request. Alias proof normalization uses two authored spellings of the same existing native source; conflicting checker text, disk content and missing disk proof are separate refusals without another Program or process.
// @evidence contracts/testing.md#execution-ownership TestServeSnapshotProvesItsProgramWithoutASecondRead is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSnapshotProvesItsProgramWithoutASecondRead(t *testing.T) {
  root := graphSessionFixture(t)
  var output bytes.Buffer
  if code := serveSourceSnapshots(strings.NewReader("{\"id\":1}\n"), &output, root, "tsconfig.json"); code != 0 {
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
  if provenance.Producer.Tool != "ttscgraph" {
    t.Fatalf("provenance names producer %q, want ttscgraph", provenance.Producer.Tool)
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

  // Every non-external node file must have a source-manifest entry. This check
  // does not reproduce the checker-text digest or authenticate the node facts.
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
      t.Fatalf("cannot independently read disk-digested source %q: %v", file, err)
    }
    if got := graph.Digest(sha256.Sum256(content)); got != source.Disk {
      t.Fatalf("independent read of %q hashes to %s, manifest says %s", file, got, source.Disk)
    }
    proven++
  }
  if proven == 0 {
    t.Fatal("no supplied disk digest was independently reproduced")
  }
  // The two raw spellings name one native file in this generation. Only
  // complete matching checker/disk witnesses permit one wire identity.
  var file string
  if len(provenance.Sources) == 0 {
    t.Fatal("the initial source generation must be nonempty")
  }
  var picked graph.SourceDigest
  for _, source := range provenance.Sources {
    if source.Checker != "" && source.Disk != "" {
      picked = source
      break
    }
  }
  if picked.File == "" {
    t.Fatal("no complete native generation source was available for alias proof")
  }
  file = filepath.Join(root, filepath.FromSlash(picked.File))
  alias := filepath.Dir(file) + string(filepath.Separator) + "." + string(filepath.Separator) + filepath.Base(file)
  first := picked
  first.File = file
  second := first
  second.File = alias
  pair := provenance
  pair.Sources = []graph.SourceDigest{first, second}
  normalized, owners, err := normalizeServeGraphProvenance(root, pair, true)
  if err != nil || len(normalized.Sources) != 1 || len(owners) != 2 || owners[file] != owners[alias] {
    t.Fatalf("same native source aliases were not retained at one proven wire owner: %v, %#v", err, owners)
  }
  for _, bad := range []graph.SourceDigest{
    {File: alias, Checker: "different-generation", Disk: first.Disk},
    {File: alias, Checker: first.Checker, Disk: "different-content"},
    {File: alias, Checker: first.Checker},
  } {
    pair.Sources = []graph.SourceDigest{first, bad}
    if _, _, err := normalizeServeGraphProvenance(root, pair, true); err == nil {
      t.Fatalf("a conflicting or incomplete alias proof was accepted: %#v", bad)
    }
  }
}
