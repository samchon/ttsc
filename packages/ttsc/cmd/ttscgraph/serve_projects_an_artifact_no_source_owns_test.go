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
// The shard projection assigns every node to the source that owns it, and fails
// closed when a node names a file the manifest does not carry — a guard that is
// right for a declaration, whose file is always a program source. A published
// artifact has no such file: it is a Markdown document, a Prisma schema, or, for
// an operation named by method and path, nothing at all. So the guard rejected
// it and the resident session failed to start for any project that publishes
// one, which is the whole product surface.
//
// The metadata shard is where facts no source owns belong, and the client
// exempts it from the ownership check for that reason.
//
//  1. Build a session over a one-file project, carrying one artifact.
//  2. Take a full shard snapshot.
//  3. Assert it succeeded and that the artifact is in it.
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

  snapshot, _, err := session.buildFullShardSnapshot()
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

  // The session's own claim, which is what the envelope answers with. An
  // `unchanged` response carries no dump, so the envelope is the only place a
  // client can learn this server holds artifacts; a shared constant there made
  // the envelope and the dump disagree on exactly that frame.
  if !slices.Contains(session.capabilities(), graph.CapabilityArtifactNodes) {
    t.Fatalf("a session holding artifacts declares %v", session.capabilities())
  }
  if session.artifactProducer() == nil {
    t.Fatal("a session holding artifacts named no second producer")
  }
}
