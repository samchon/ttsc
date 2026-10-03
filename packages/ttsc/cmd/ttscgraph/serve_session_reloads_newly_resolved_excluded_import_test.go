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
//
// @evidence contracts/testing.md#behavioral-verification Verifies a previously missing relative import becomes visible even when the new file is not a tsconfig root.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: after generated.ts is created next to an importer whose files list is unchanged, the snapshot must be mode reload, changed, with nodes named main and generated and a calls edge from main to generated, found by node name and edge kind in the dump.
// @evidence contracts/testing.md#distinguishing-cases Compile one root that imports missing, excluded `generated.ts`; Create that module without changing the importer or tsconfig roots; Assert reload mode and the newly-resolved declaration and call edge.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedExcludedImport is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  generated := filepath.Join(root, "src", "generated.ts")
  if err := os.WriteFile(generated, []byte("export function generated(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
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
