package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsCommonJSPackageEntryForESM verifies an ESM importer
// preserves the CommonJS fallback rules of a package's extensionless main.
//
// The importing source is ESM, but TypeScript-Go temporarily uses CommonJS
// lookup for a package without `type: module`. A missing main.ts therefore
// precedes main.js and must invalidate the resident session when it appears.
func TestServeSessionReloadsCommonJSPackageEntryForESM(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "package.json"), `{"type":"module"}`)
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from 'fixture-package';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "main": "./dist/main"
}`)
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "main.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "main.ts"), "export function winner(): void {}\nexport function packageEntryWinner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "packageEntryWinner") {
    t.Fatalf("CommonJS package main.ts = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
