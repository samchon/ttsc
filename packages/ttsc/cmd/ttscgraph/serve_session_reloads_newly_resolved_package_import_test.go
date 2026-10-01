package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedPackageImport verifies wildcard imports
// targets are tracked with the wildcard text matched from the package key.
//
// 1. Load the #generated/value import with a wildcard package imports mapping.
// 2. Create the substituted generated/value.ts declaration.
// 3. Require a changed reload dump.
//
// @evidence contracts/testing.md#behavioral-verification Require a changed reload dump.
// @evidence contracts/testing.md#independent-expectations The literal fixture and supported graph contract establish these expectations: Require a changed reload dump.
// @evidence contracts/testing.md#distinguishing-cases Load the #generated/value import with a wildcard package imports mapping. Create the substituted generated/value.ts declaration. Require a changed reload dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedPackageImport is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedPackageImport(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "package.json"), `{
  "name": "fixture-project",
  "imports": { "#generated/*": "./generated/*.js" }
}`)
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "nodenext", "moduleResolution": "nodenext" },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { generated } from '#generated/value';\nexport function main(): void { generated(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "generated", "value.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export function generated(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new package imports target = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
