package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedExcludedImport verifies a previously
// missing relative import becomes visible even when the new file is not a
// tsconfig root.
//
// Comparing only parsed root file names misses this transition: `files` stays
// unchanged while module resolution changes from unresolved to resolved. The
// session snapshots concrete resolution candidates and reloads when one appears.
//
// 1. Compile one root that imports missing, excluded `generated.ts`.
// 2. Create that module without changing the importer or tsconfig roots.
// 3. Assert reload mode and the newly-resolved declaration and call edge.
func TestServeSessionReloadsNewlyResolvedExcludedImport(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { generated } from './generated';\nexport function main(): void { generated(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  generated := filepath.Join(root, "src", "generated.ts")
  if err := os.WriteFile(generated, []byte("export function generated(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "generated") {
    t.Fatalf("new resolution = dump:%v mode:%q changed:%v nodes:%#v", dump != nil, mode, changed, dump)
  }
  mainID, generatedID := "", ""
  for _, node := range dump.Nodes {
    if node.Name == "main" {
      mainID = node.ID
    } else if node.Name == "generated" {
      generatedID = node.ID
    }
  }
  for _, edge := range dump.Edges {
    if edge.From == mainID && edge.To == generatedID && edge.Kind == "calls" {
      return
    }
  }
  t.Fatalf("reloaded graph omitted main -> generated call: %#v", dump.Edges)
}
