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
//
// 1. Load a conditional export with browser, types and default branches and a JavaScript fallback.
// 2. Create the inactive browser file, then the selected types declaration.
// 3. Require no dump for the inactive branch and a reload for the selected types branch.
//
// @evidence contracts/testing.md#behavioral-verification Creating the file behind an export condition the active nodenext lookup cannot select (browser) leaves a resident session unchanged with no dump, while creating the selected types declaration reloads it.
// @evidence contracts/testing.md#independent-expectations The expected outcomes follow from package exports condition semantics for the nodenext/types lookup: the browser branch is inactive so creating dist/browser.js must be unchanged with no dump, and creating dist/types.d.ts, which precedes the default fallback, must be mode reload and changed. The reload step asserts the mode and change flag, not the new declaration's node.
// @evidence contracts/testing.md#distinguishing-cases Load a conditional export with browser, types and default branches and a JavaScript fallback. Create the inactive browser file, then the selected types declaration. Require no dump for the inactive branch and a reload for the selected types branch.
// @evidence contracts/testing.md#execution-ownership TestServeSessionKeepsInactiveConditionalExportUnchanged is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "browser.js"), "export function winner() {}\nexport function browserOnly() {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("inactive browser condition = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "types.d.ts"), "export declare function winner(): void;\nexport declare function typesWinner(): void;\n")
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed {
    t.Fatalf("active types condition = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
