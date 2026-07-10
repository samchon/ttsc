package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsExtendedConfigChange verifies every config in an
// extends chain participates in snapshot freshness.
//
// Watching only the requested tsconfig misses compiler-option changes inherited
// from a base file. The session records all parsed extended source files and
// must full-reload before answering after any one changes.
//
// 1. Create a project whose tsconfig extends `base.json`.
// 2. Build once, then change a compiler option only in the base config.
// 3. Assert the next snapshot reports a full reload.
func TestServeSessionReloadsExtendedConfigChange(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "base.json"), `{"compilerOptions":{"strict":true,"target":"ES2022"}}`)
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{"extends":"./base.json","include":["src"]}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export class Value {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  base := filepath.Join(root, "base.json")
  if err := os.WriteFile(base, []byte(`{"compilerOptions":{"strict":false,"target":"ES2022"}}`), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("extended config edit = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
