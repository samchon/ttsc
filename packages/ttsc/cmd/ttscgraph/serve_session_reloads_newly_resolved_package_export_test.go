package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedPackageExport verifies an exports target
// appearing under an existing package triggers module-resolution reload.
//
// 1. Load fixture-package/feature with an existing exports map and missing target.
// 2. Create the mapped dist/feature.ts declaration.
// 3. Require a changed reload dump.
//
// @evidence contracts/testing.md#behavioral-verification Creating dist/feature.ts behind the existing exports target ./dist/feature.js reports reload, changed and a nonnil dump. The pinned resolver permits that .js-to-.ts substitution; this test does not assert the initial unresolved diagnostic, its disappearance or the new declaration node.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: the exports map targets ./dist/feature.js, which does not exist, and creating dist/feature.ts must yield mode reload, changed, with a dump. The new declaration's node is not asserted.
// @evidence contracts/testing.md#distinguishing-cases Load fixture-package/feature with an existing exports map and missing target. Create the mapped dist/feature.ts declaration. Require a changed reload dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedPackageExport is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedPackageExport(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { feature } from 'fixture-package/feature';\nexport function main(): void { feature(); }\n")
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "exports": { "./feature": "./dist/feature.js" }
}`)

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "node_modules", "fixture-package", "dist", "feature.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export function feature(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new package export target = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
