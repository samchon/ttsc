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
//
// 1. Load an ESM importer of a CommonJS package with extensionless main and a JavaScript fallback.
// 2. Create node_modules package main.ts ahead of its fallback.
// 3. Require a reload containing the TypeScript winner at the literal package main.ts path.
//
// @evidence contracts/testing.md#behavioral-verification Creating dist/main.ts for a CommonJS-style package main './dist/main' imported from an ESM project reloads a resident session, and the new dump holds the winner declaration at node_modules/fixture-package/dist/main.ts.
// @evidence contracts/testing.md#independent-expectations The expected outcome follows from the TypeScript-Go rule the test cites that a package without type: module uses CommonJS lookup for its extensionless main, so main.ts outranks main.js: the snapshot must be mode reload, changed, with a node named winner located at the literal package path dist/main.ts.
// @evidence contracts/testing.md#distinguishing-cases Load an ESM importer of a CommonJS package with extensionless main and a JavaScript fallback. Create node_modules package main.ts ahead of its fallback. Require a reload containing the TypeScript winner at the literal package main.ts path.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsCommonJSPackageEntryForESM is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "main.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNodeAt(*dump, "winner", "node_modules/fixture-package/dist/main.ts") {
    t.Fatalf("CommonJS package main.ts = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
