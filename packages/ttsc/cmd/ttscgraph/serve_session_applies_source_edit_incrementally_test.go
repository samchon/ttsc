package main

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeSessionAppliesSourceEditIncrementally verifies a content-only source
// edit updates the graph through the resident tsgo Program.
//
// A declaration rename changes graph nodes but not imports, so UpdateProgram can
// reuse every unchanged AST. The new dump must expose the replacement symbol
// and remove the old one without reopening the project.
//
// 1. Build the initial graph containing `BeforeEdit`.
// 2. Replace it with `AfterEdit` in the same source file.
// 3. Assert incremental mode and an exact post-edit node set.
func TestServeSessionAppliesSourceEditIncrementally(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  file := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(file, []byte("export class AfterEdit {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "incremental" || !changed {
    t.Fatalf("edited snapshot = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
  if !hasDumpNode(*dump, "AfterEdit") || hasDumpNode(*dump, "BeforeEdit") {
    t.Fatalf("incremental dump kept stale nodes: %#v", dump.Nodes)
  }
}

func hasDumpNode(dump graph.Dump, name string) bool {
  for _, node := range dump.Nodes {
    if node.Name == name {
      return true
    }
  }
  return false
}
