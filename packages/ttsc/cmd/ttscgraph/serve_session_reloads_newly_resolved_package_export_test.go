package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedPackageExport verifies an exports target
// appearing under an existing package triggers module-resolution reload.
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
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "node_modules", "fixture-package", "dist", "feature.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export function feature(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new package export target = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
