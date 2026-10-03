package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedTypeReference verifies triple-slash type
// directives honor configured typeRoots when a missing package appears.
//
// 1. Load a triple-slash fixture-types reference with explicit ./types roots.
// 2. Create types/fixture-types/index.d.ts declaring FixtureType.
// 3. Require a changed reload dump.
//
// @evidence contracts/testing.md#behavioral-verification Creating types/fixture-types/index.d.ts under the configured typeRoots satisfies a triple-slash types reference that was unresolved and reloads a resident session.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: the types directive names fixture-types, typeRoots is ./types, and creating types/fixture-types/index.d.ts must yield mode reload, changed, with a dump. The FixtureType declaration itself is not asserted.
// @evidence contracts/testing.md#distinguishing-cases Load a triple-slash fixture-types reference with explicit ./types roots. Create types/fixture-types/index.d.ts declaring FixtureType. Require a changed reload dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedTypeReference is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedTypeReference(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "typeRoots": ["./types"] },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "/// <reference types=\"fixture-types\" />\nexport const value: FixtureType = { id: 1 };\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "types", "fixture-types", "index.d.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("interface FixtureType { id: number }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new type reference = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
