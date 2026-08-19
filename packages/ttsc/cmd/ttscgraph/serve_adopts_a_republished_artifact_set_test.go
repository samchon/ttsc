package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "testing"
)

// TestServeAdoptsARepublishedArtifactSet verifies a resident session replaces
// its artifacts when the client republishes them, and does so without reloading
// the compiler.
//
// The artifacts describe documents the Program never read. That is deliberate —
// it is what keeps editing a Markdown heading from costing a typecheck — but it
// also means not one of the session's invalidation inputs moves when the
// document does. Read once at startup, the set outlived every edit to it: a
// developer who renamed a section watched the graph keep answering with the name
// it used to have, for as long as the editor stayed open.
//
// The mode is asserted, not merely the change. Reloading the Program would also
// pick up the new set, and would also report `changed`; it would just pay a full
// typecheck for a fact the compiler has no opinion about. `rebuild` is the
// answer that reuses the resident Program and reprojects it, and it is the only
// one that keeps the property this design exists for.
//
//  1. Publish one artifact set and take an initial snapshot naming it.
//  2. Ask again naming the same file, and require `unchanged`.
//  3. Publish a different set and ask again naming the new file.
//  4. Require a `rebuild` carrying the new artifact and not the old one.
//  5. Name a file that does not exist and require an error, not an empty graph.
func TestServeAdoptsARepublishedArtifactSet(t *testing.T) {
  root := graphSessionFixture(t)
  published := t.TempDir()
  first := filepath.Join(published, "first.json")
  second := filepath.Join(published, "second.json")
  writeArtifactSet(t, first, "docs/sale.md#pricing", "Pricing")
  writeArtifactSet(t, second, "docs/sale.md#discounts", "Discounts")

  var output bytes.Buffer
  code := serveSnapshotsWithArtifacts(
    bytes.NewReader([]byte(fmt.Sprintf(
      "{\"id\":1,\"artifacts\":%s}\n{\"id\":2,\"artifacts\":%s}\n{\"id\":3,\"artifacts\":%s}\n{\"id\":4,\"artifacts\":%s}\n",
      mustJSONString(t, first),
      mustJSONString(t, first),
      mustJSONString(t, second),
      mustJSONString(t, filepath.Join(published, "never-written.json")),
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
  responses := make([]serveResponse, 4)
  for index := range responses {
    if err := decoder.Decode(&responses[index]); err != nil {
      t.Fatalf("response %d: %v", index+1, err)
    }
  }
  initial, repeated, republished := responses[0], responses[1], responses[2]
  missing := responses[3]

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
