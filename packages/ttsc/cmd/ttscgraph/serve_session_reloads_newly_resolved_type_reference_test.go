package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedTypeReference verifies triple-slash type
// directives honor configured typeRoots when a missing package appears.
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
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "types", "fixture-types", "index.d.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("interface FixtureType { id: number }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new type reference = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
