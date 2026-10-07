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
// @evidence contracts/testing.md#behavioral-verification Creating types/fixture-types/index.d.ts behind the source's triple-slash reference reports reload, changed and a nonnil dump. Initial diagnostic disappearance and the FixtureType node are not asserted.
// @evidence contracts/testing.md#independent-expectations The literal directive names fixture-types and typeRoots is ./types. Creating the named package must report reload, changed and a dump. The pinned source-type-reference replay supplies this freshness path; the diagnostic contents and FixtureType node are not asserted.
// @evidence contracts/testing.md#distinguishing-cases Load the missing triple-slash fixture-types reference with ./types roots; create its index.d.ts declaring FixtureType; require a changed reload dump without an importer edit.
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
