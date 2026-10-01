package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedRootDirsTarget verifies virtual relative
// paths across rootDirs participate in module-resolution freshness.
//
// 1. Load a virtual ./template import under src/views with src and generated roots.
// 2. Create generated/views/template.ts.
// 3. Require a changed reload dump containing template.
//
// @evidence contracts/testing.md#behavioral-verification Require a changed reload dump containing template.
// @evidence contracts/testing.md#independent-expectations The literal fixture and supported graph contract establish these expectations: Require a changed reload dump containing template.
// @evidence contracts/testing.md#distinguishing-cases Load a virtual ./template import under src/views with src and generated roots. Create generated/views/template.ts. Require a changed reload dump containing template.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedRootDirsTarget is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedRootDirsTarget(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "rootDirs": ["src", "generated"]
  },
  "files": ["src/views/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "views", "index.ts"), "import { template } from './template';\nexport function render(): void { template(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "generated", "views", "template.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export function template(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "template") {
    t.Fatalf("new rootDirs target = dump:%v mode:%q changed:%v nodes:%#v", dump != nil, mode, changed, dump)
  }
}
