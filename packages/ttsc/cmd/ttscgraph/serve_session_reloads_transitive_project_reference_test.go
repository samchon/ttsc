package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsTransitiveProjectReference verifies config and root
// freshness traverses the complete project-reference graph, not only the
// root config's direct references.
func TestServeSessionReloadsTransitiveProjectReference(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "files": ["src/index.ts"],
  "references": [{ "path": "./middle" }]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export const root = 1;\n")
  writeGraphFile(t, filepath.Join(root, "middle", "tsconfig.json"), `{
  "compilerOptions": { "composite": true },
  "files": ["src/index.ts"],
  "references": [{ "path": "../leaf" }]
}`)
  writeGraphFile(t, filepath.Join(root, "middle", "src", "index.ts"), "export const middle = 1;\n")
  writeGraphFile(t, filepath.Join(root, "leaf", "tsconfig.json"), `{
  "compilerOptions": { "composite": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "leaf", "src", "index.ts"), "export const leaf = 1;\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  leafConfig := filepath.ToSlash(filepath.Join(root, "leaf", "tsconfig.json"))
  if _, ok := session.configHashes[leafConfig]; !ok {
    t.Fatalf("transitive project config was not tracked: %s; got %#v", leafConfig, session.configHashes)
  }
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  added := filepath.Join(root, "leaf", "src", "added.ts")
  if err := os.WriteFile(added, []byte("export const added = 1;\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("transitive root addition = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
