package main

import (
  "bytes"
  "encoding/json"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeKeepsAStartupSetAClientNeverMentions verifies an omitted artifact field preserves the startup set.
//
// Omission carries no replacement instruction, whereas an explicit empty path
// withdraws artifacts. The resident source operation must retain its supplied
// startup set across both initial and unchanged requests.
//
// 1. Supply the literal startup artifact to the resident operation.
// 2. Send two NDJSON requests without an artifacts field.
// 3. Require the initial node, unchanged second response and retained claim.
//
// @evidence contracts/testing.md#behavioral-verification serveSnapshotRequests retains the supplied startup artifact when both requests omit artifacts, returning its node initially and preserving the artifactNodes claim on unchanged.
// @evidence contracts/testing.md#independent-expectations The explicitly supplied docs/sale.md#pricing startup entry is the literal fact. Requests with no artifacts key state no withdrawal, so the first response must carry the node, the second must be unchanged with Changed false, and both envelopes must keep the artifactNodes capability; treating silence as withdrawal would fail the second request.
// @evidence contracts/testing.md#distinguishing-cases Initial versus repeated field omission distinguishes preserving startup state from explicit empty-path withdrawal in the republish case. This source case supplies the startup value directly and does not parse a CLI flag.
// @evidence contracts/testing.md#execution-ownership TestServeKeepsAStartupSetAClientNeverMentions is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeKeepsAStartupSetAClientNeverMentions(t *testing.T) {
  root := graphSessionFixture(t)

  var output bytes.Buffer
  code := serveSourceSnapshotsWithArtifacts(
    bytes.NewReader([]byte("{\"id\":1}\n{\"id\":2}\n")),
    &output,
    root,
    "tsconfig.json",
    []graph.Artifact{{
      Address:  "docs/sale.md#pricing",
      File:     "docs/sale.md",
      Kind:     "markdown_section",
      Line:     7,
      Readable: "Pricing",
    }},
  )
  if code != 0 {
    t.Fatalf("serveSnapshotsWithArtifacts exited %d: %s", code, output.String())
  }

  decoder := json.NewDecoder(&output)
  var initial serveResponse
  var second serveResponse
  if err := decoder.Decode(&initial); err != nil {
    t.Fatal(err)
  }
  if err := decoder.Decode(&second); err != nil {
    t.Fatal(err)
  }
  if !dumpCarriesArtifact(initial.Dump, "docs/sale.md#pricing") {
    t.Fatalf("the startup set is absent from the initial dump: %#v", initial)
  }
  // The second request is where a silence-means-withdrawal reading would show:
  // the first is the initial projection and carries the set either way.
  if second.Mode != serveModeUnchanged || second.Changed {
    t.Fatalf("a request naming no artifacts was treated as a change: %#v", second)
  }
  for _, response := range []serveResponse{initial, second} {
    if !slices.Contains(response.Capabilities, string(graph.CapabilityArtifactNodes)) {
      t.Fatalf("a session holding the startup set stopped claiming it: %v", response.Capabilities)
    }
  }
}
