package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsInactiveConditionalExportUnchanged verifies a
// condition the active TypeScript-Go lookup cannot select is not a graph
// freshness input.
//
// An inactive branch can be present ahead of the active `types` and `default`
// branches in package.json, but creating that target must not reload a
// resident ESM session. Creating the missing active `types` target still must.
func TestServeSessionKeepsInactiveConditionalExportUnchanged(t *testing.T) {
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
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from 'fixture-package/feature';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "exports": {
    "./feature": {
      "browser": "./dist/browser.js",
      "types": "./dist/types.d.ts",
      "default": "./dist/fallback.js"
    }
  }
}`)
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "fallback.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "browser.js"), "export function winner() {}\nexport function browserOnly() {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("inactive browser condition = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "types.d.ts"), "export declare function winner(): void;\nexport declare function typesWinner(): void;\n")
  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed {
    t.Fatalf("active types condition = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
