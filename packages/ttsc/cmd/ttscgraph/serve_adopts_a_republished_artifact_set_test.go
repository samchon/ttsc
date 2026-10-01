package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeAdoptsARepublishedArtifactSet verifies replacing artifact inputs reprojects a resident graph.
//
// Artifact documents are outside the compiler source set. Their replacement
// requires rebuild publication without a compiler input edit; omitting the field
// and explicitly withdrawing the set must remain different requests.
//
// 1. Publish Pricing and repeat the same named set, requiring unchanged.
// 2. Publish Discounts, requiring rebuild with the new node and no old node.
// 3. Name a missing set and require an error without snapshot state.
// 4. Explicitly withdraw artifacts and require their nodes and claim removed.
//
// @evidence contracts/testing.md#behavioral-verification Actual NDJSON requests retain an identical artifact set, replace it with rebuild publication, fail a missing named file without graph state and withdraw it on an explicit empty path.
// @evidence contracts/testing.md#independent-expectations Literal pricing/discounts addresses and headings define the old and new nodes. Unedited compiler sources make unchanged and rebuild the expected modes; a missing file is an error, and explicit withdrawal removes both the node and artifactNodes claim.
// @evidence contracts/testing.md#distinguishing-cases Initial, repeated, republished, missing and empty-path requests contrast artifact identity, failure and withdrawal; absence of the artifacts field is owned by the startup-set case.
// @evidence contracts/testing.md#execution-ownership TestServeAdoptsARepublishedArtifactSet is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeAdoptsARepublishedArtifactSet(t *testing.T) {
  root := graphSessionFixture(t)
  published := t.TempDir()
  first := filepath.Join(published, "first.json")
  second := filepath.Join(published, "second.json")
  writeArtifactSet(t, first, "docs/sale.md#pricing", "Pricing")
  writeArtifactSet(t, second, "docs/sale.md#discounts", "Discounts")

  var output bytes.Buffer
  code := serveSourceSnapshotsWithArtifacts(
    bytes.NewReader([]byte(fmt.Sprintf(
      "{\"id\":1,\"artifacts\":%s}\n{\"id\":2,\"artifacts\":%s}\n{\"id\":3,\"artifacts\":%s}\n{\"id\":4,\"artifacts\":%s}\n{\"id\":5,\"artifacts\":%s}\n",
      mustJSONString(t, first),
      mustJSONString(t, first),
      mustJSONString(t, second),
      mustJSONString(t, filepath.Join(published, "never-written.json")),
      `""`,
    ))),
    &output,
    root,
    "tsconfig.json",
    nil,
  )
  if code != 0 {
    t.Fatalf("serveSnapshotsWithArtifacts exited %d: %s", code, output.String())
  }

  decoder := json.NewDecoder(&output)
  responses := make([]serveResponse, 5)
  for index := range responses {
    if err := decoder.Decode(&responses[index]); err != nil {
      t.Fatalf("response %d: %v", index+1, err)
    }
  }
  initial, repeated, republished := responses[0], responses[1], responses[2]
  missing, withdrawn := responses[3], responses[4]

  if initial.Mode != serveModeInitial || !initial.Changed || initial.Dump == nil {
    t.Fatalf("initial response: %#v", initial)
  }
  if !dumpCarriesArtifact(initial.Dump, "docs/sale.md#pricing") {
    t.Fatal("the initial dump does not carry the artifact its request named")
  }

  // Naming the same file again must cost nothing. The client states the path on
  // every request because only it can see the inputs behind the set; a server
  // that treated the statement itself as news would reproject the whole graph
  // on every single call.
  if repeated.Mode != serveModeUnchanged || repeated.Changed || repeated.Dump != nil {
    t.Fatalf("restating the same artifact file was treated as a change: %#v", repeated)
  }

  if republished.Mode != serveModeRebuild {
    t.Fatalf(
      "a republished artifact set answered %q; %q reuses the resident program, and no compiler input moved",
      republished.Mode,
      serveModeRebuild,
    )
  }
  if !republished.Changed || republished.Dump == nil {
    t.Fatalf("republished response carried no graph: %#v", republished)
  }
  if !dumpCarriesArtifact(republished.Dump, "docs/sale.md#discounts") {
    t.Fatal("the republished dump does not carry the artifact that replaced the old one")
  }
  if dumpCarriesArtifact(republished.Dump, "docs/sale.md#pricing") {
    t.Fatal("the republished dump still carries the withdrawn artifact")
  }

  // A named file that is not there is a broken exchange, not a project without
  // artifacts. Reading it as the latter empties the overlay and answers with a
  // graph indistinguishable from a correct one for a project that publishes
  // none — the one failure this whole exchange has no other way to catch.
  if missing.Mode != serveModeError || missing.Error == "" {
    t.Fatalf("a named artifact file that does not exist answered %#v", missing)
  }
  if missing.Dump != nil || missing.Changed {
    t.Fatalf("an error response carried snapshot state: %#v", missing)
  }

  // The empty path is how a client says it now publishes none — the state a
  // project reaches by removing its plugin. Without it the only sayable things
  // are "here is a set" and "no opinion", and the removal would go on being
  // answered with the artifacts of a plugin that is gone.
  if withdrawn.Mode != serveModeRebuild || !withdrawn.Changed {
    t.Fatalf("withdrawing the artifacts answered %#v", withdrawn)
  }
  if dumpCarriesArtifact(withdrawn.Dump, "docs/sale.md#discounts") {
    t.Fatal("a withdrawn artifact is still in the graph")
  }
  if slices.Contains(withdrawn.Capabilities, string(graph.CapabilityArtifactNodes)) {
    t.Fatalf("a session holding no artifacts still claims them: %v", withdrawn.Capabilities)
  }
}

// writeArtifactSet publishes a one-entry set in the shape the client writes.
func writeArtifactSet(t *testing.T, file, address, readable string) {
  t.Helper()
  contents, err := json.Marshal([]map[string]any{{
    "address":  address,
    "kind":     "markdown_section",
    "readable": readable,
    "file":     "docs/sale.md",
    "line":     7,
  }})
  if err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, contents, 0o644); err != nil {
    t.Fatal(err)
  }
}

// mustJSONString quotes a path for the request line, which matters on Windows
// where a temporary directory is full of separators JSON reads as escapes.
func mustJSONString(t *testing.T, value string) string {
  t.Helper()
  encoded, err := json.Marshal(value)
  if err != nil {
    t.Fatal(err)
  }
  return string(encoded)
}

func dumpCarriesArtifact(dump any, address string) bool {
  encoded, err := json.Marshal(dump)
  if err != nil {
    return false
  }
  var decoded struct {
    Nodes []struct {
      ID string `json:"id"`
    } `json:"nodes"`
  }
  if err := json.Unmarshal(encoded, &decoded); err != nil {
    return false
  }
  for _, node := range decoded.Nodes {
    if node.ID == address {
      return true
    }
  }
  return false
}

// shardsCarrySource reports whether a shard for the named source was upserted.
func shardsCarrySource(snapshot *serveGraphSnapshot, suffix string) bool {
  for _, upsert := range snapshot.Upserts {
    if upsert.Shard.Source == nil {
      continue
    }
    if strings.HasSuffix(upsert.Shard.Source.File, suffix) {
      return true
    }
  }
  return false
}

// shardsCarryArtifact reports whether any upserted shard holds the address.
func shardsCarryArtifact(snapshot *serveGraphSnapshot, address string) bool {
  for _, upsert := range snapshot.Upserts {
    for _, node := range upsert.Shard.Nodes {
      if node.ID == address {
        return true
      }
    }
  }
  return false
}
