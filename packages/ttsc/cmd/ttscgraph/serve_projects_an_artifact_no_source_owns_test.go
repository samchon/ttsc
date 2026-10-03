package main

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeProjectsAnArtifactNoSourceOwns verifies that a session carrying
// published artifacts can produce a shard snapshot at all.
//
// A document-backed artifact and a fileless operation are not program source
// nodes. Both must survive projection, while each source-bearing shard must
// contain only nodes from its named source. This test observes node membership
// and source ownership, not client validation or every artifact kind.
//
//  1. Build a session over a one-file project, carrying two artifacts.
//  2. Take a full shard snapshot.
//  3. Assert it succeeded and that the artifact is in it.
//
// @evidence contracts/testing.md#behavioral-verification Verifies that a session carrying published artifacts can produce a shard snapshot at all.
// @evidence contracts/testing.md#independent-expectations Literal supplied addresses docs/sale.md#pricing and POST:/orders must each appear in an upserted shard; the latter has no file. Any source-bearing shard must contain only nodes from its source file. The session must carry the artifactNodes capability and a nonnil artifact producer. These assertions detect rejection or source misassignment of these artifacts, without certifying producer metadata contents or a particular metadata-shard key.
// @evidence contracts/testing.md#distinguishing-cases A document-backed artifact versus a fileless operation share one program fixture; full projection must include both, source-bearing shards must obey their ownership boundary, and the session must retain its capability and producer claim.
// @evidence contracts/testing.md#execution-ownership TestServeProjectsAnArtifactNoSourceOwns is a Go source-unit entry. It builds a resident session with newGraphSessionWithArtifacts and projects a full shard snapshot through projectFullGraphShards with explicit empty ignore membership; the compiler session is real and in-process, with no installed consumer, native build or Git acquisition.
func TestServeProjectsAnArtifactNoSourceOwns(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}
`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), `/** @evidence docs/sale.md#pricing States the rule. */
export function priced(): void {}
`)

  session, err := newGraphSessionWithArtifacts(root, "tsconfig.json", []graph.Artifact{
    {
      Address:  "docs/sale.md#pricing",
      Kind:     "markdown_section",
      Readable: "Pricing",
      File:     "docs/sale.md",
      Line:     7,
    },
    {
      // No file at all, which is the shape that has no source to be owned by
      // even in principle.
      Address:  "POST:/orders",
      Kind:     "swagger_operation",
      Readable: "POST /orders",
    },
  })
  if err != nil {
    t.Fatalf("the session refused to start with artifacts: %v", err)
  }
  defer func() { _ = session.Close() }()

  snapshot, _, err := projectFullGraphShards(session)
  if err != nil {
    t.Fatalf("the shard projection rejected a published artifact: %v", err)
  }

  published := map[string]bool{}
  for _, upsert := range snapshot.Upserts {
    for _, node := range upsert.Shard.Nodes {
      published[node.ID] = true
      if upsert.Shard.Source != nil && node.File != upsert.Shard.Source.File {
        t.Fatalf("shard %s owns node %s from %s", upsert.Shard.Key, node.ID, node.File)
      }
    }
  }
  for _, address := range []string{"docs/sale.md#pricing", "POST:/orders"} {
    if !published[address] {
      t.Fatalf("the snapshot carries no node for %q", address)
    }
  }

  // Observe the session's claim directly. This test does not send an unchanged
  // request or validate a client's handling of the response envelope.
  if !slices.Contains(session.capabilities(), graph.CapabilityArtifactNodes) {
    t.Fatalf("a session holding artifacts declares %v", session.capabilities())
  }
  if session.artifactProducer() == nil {
    t.Fatal("a session holding artifacts named no second producer")
  }
}
