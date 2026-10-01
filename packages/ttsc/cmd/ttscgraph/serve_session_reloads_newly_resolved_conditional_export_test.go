package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedConditionalExport verifies conditional
// exports objects and array fallbacks contribute resolution candidates.
//
// Real packages rarely map a subpath straight to one string: `exports`
// commonly nests condition objects (`types`, `default`) and array fallbacks.
// Every leaf target must be tracked, or a package shipping its compiled
// output later stays invisible to the resident graph.
//
//  1. Import a package subpath whose exports leaf targets do not exist yet.
//  2. Create the `types` condition's declaration target.
//  3. Assert the next snapshot reports a full reload.
//
// @evidence contracts/testing.md#behavioral-verification Verifies conditional exports objects and array fallbacks contribute resolution candidates.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish "reload"; the next snapshot reports a full reload.
// @evidence contracts/testing.md#distinguishing-cases Import a package subpath whose exports leaf targets do not exist yet; Create the `types` condition's declaration target; Assert the next snapshot reports a full reload.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedConditionalExport is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedConditionalExport(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { feature } from 'fixture-package/feature';\nexport function main(): void { feature(); }\n")
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "exports": {
    "./feature": {
      "types": "./dist/feature.d.ts",
      "default": ["./dist/feature.js"]
    }
  }
}`)

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "node_modules", "fixture-package", "dist", "feature.d.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export declare function feature(): void;\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new conditional export target = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
