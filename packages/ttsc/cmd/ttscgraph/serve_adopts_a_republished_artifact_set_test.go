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
//  6. State the empty path and require the artifacts withdrawn.
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

// TestServeKeepsAStartupSetAClientNeverMentions verifies that a request saying
// nothing about artifacts leaves the ones the session started with alone.
//
// Three clients reach this path and none of them names a file: one built before
// the field existed, one driving `ttscgraph serve --artifacts` by hand, and one
// whose project publishes nothing but whose session was handed a set through
// the flag. Reading their silence as "I have none" would empty the graph for
// all three — and it is the same code path that must read an explicit empty
// statement as exactly that, which is why the two are a pointer apart rather
// than an empty string apart.
//
//  1. Start a session with an artifact set through the flag.
//  2. Send two requests carrying no artifacts field at all.
//  3. Require the set to survive both, and the capability to stay claimed.
func TestServeKeepsAStartupSetAClientNeverMentions(t *testing.T) {
  root := graphSessionFixture(t)

  var output bytes.Buffer
  code := serveSnapshotsWithArtifacts(
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

// TestServeAdoptsARepublishedSetOverTheShardProtocol verifies the refresh
// reaches the protocol the product actually speaks.
//
// `@ttsc/graph` negotiates incremental shards on every request, so the
// full-dump response the other cases drive is the compatibility path and not
// the one a running editor uses. The two share one invalidation decision and
// then diverge completely — different projection, different snapshot shape,
// different assembly of what a client ends up holding — so a refresh proven on
// one is not proven on the other.
//
//  1. Negotiate shards and take an initial snapshot naming one artifact set.
//  2. Name a different set on the next request.
//  3. Require a full shard snapshot carrying the new artifact and not the old.
func TestServeAdoptsARepublishedSetOverTheShardProtocol(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  // The declaration cites the artifact, so the edge to it lives in this
  // source's own shard while the artifact node lands in the metadata shard.
  // Both have to move together: a snapshot that replaced the artifact and left
  // this shard alone would leave the client holding an edge into an address
  // nothing publishes any more.
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"),
    "/** @evidence docs/sale.md#pricing States the rule. */\nexport class Priced {}\n")
  published := t.TempDir()
  first := filepath.Join(published, "first.json")
  second := filepath.Join(published, "second.json")
  writeArtifactSet(t, first, "docs/sale.md#pricing", "Pricing")
  writeArtifactSet(t, second, "docs/sale.md#discounts", "Discounts")

  var output bytes.Buffer
  code := serveSnapshotsWithArtifacts(
    bytes.NewReader([]byte(fmt.Sprintf(
      "{\"id\":1,\"graphSnapshotVersion\":%d,\"artifacts\":%s}\n{\"id\":2,\"graphSnapshotVersion\":%d,\"artifacts\":%s}\n",
      graphSnapshotProtocolVersion,
      mustJSONString(t, first),
      graphSnapshotProtocolVersion,
      mustJSONString(t, second),
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
  var initial serveResponse
  var republished serveResponse
  if err := decoder.Decode(&initial); err != nil {
    t.Fatal(err)
  }
  if err := decoder.Decode(&republished); err != nil {
    t.Fatal(err)
  }
  if initial.Snapshot == nil {
    t.Fatalf("the shard protocol was not negotiated: %#v", initial)
  }
  if !shardsCarryArtifact(initial.Snapshot, "docs/sale.md#pricing") {
    t.Fatal("the initial shard snapshot does not carry the artifact its request named")
  }
  if republished.Mode != serveModeRebuild || republished.Snapshot == nil {
    t.Fatalf("a republished set over the shard protocol answered %#v", republished)
  }
  if !shardsCarryArtifact(republished.Snapshot, "docs/sale.md#discounts") {
    t.Fatal("the republished shard snapshot does not carry the artifact that replaced the old one")
  }
  if shardsCarryArtifact(republished.Snapshot, "docs/sale.md#pricing") {
    t.Fatal("the republished shard snapshot still carries the withdrawn artifact")
  }
  // The citing source's shard has to come with it, whichever projection the
  // session chose. Its edges name the address that just moved, so a client left
  // holding the previous version of this shard holds a dangling one.
  if !shardsCarrySource(republished.Snapshot, "src/index.ts") {
    t.Fatal("the shard owning the citing declaration was not re-emitted, so its edge to the withdrawn address survives in the client")
  }
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
