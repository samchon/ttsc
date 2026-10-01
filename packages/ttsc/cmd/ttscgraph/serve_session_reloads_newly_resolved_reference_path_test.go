package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedReferencePath verifies triple-slash path
// directives participate in freshness even though they are not AST statements.
//
// 1. Load a triple-slash path reference to missing generated/types.d.ts.
// 2. Create the referenced Generated interface.
// 3. Require a changed reload dump.
//
// @evidence contracts/testing.md#behavioral-verification Require a changed reload dump.
// @evidence contracts/testing.md#independent-expectations The literal fixture and supported graph contract establish these expectations: Require a changed reload dump.
// @evidence contracts/testing.md#distinguishing-cases Load a triple-slash path reference to missing generated/types.d.ts. Create the referenced Generated interface. Require a changed reload dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedReferencePath is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedReferencePath(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "/// <reference path=\"../generated/types.d.ts\" />\nexport const value: Generated = { id: 1 };\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "generated", "types.d.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("interface Generated { id: number }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new reference path = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
