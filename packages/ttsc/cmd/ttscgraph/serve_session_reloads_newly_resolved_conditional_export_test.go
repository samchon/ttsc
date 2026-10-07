package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedConditionalExport verifies creating the
// missing types target in this conditional export reports a reload.
//
// Both types and default targets begin absent. The default is a one-element
// array, but only the types file is created. Array fallback selection, inactive
// branches, the initial unresolved diagnostic and the new declaration's node
// are not asserted by this case.
//
//  1. Import a package subpath whose exports leaf targets do not exist yet.
//  2. Create the `types` condition's declaration target.
//  3. Assert the next snapshot reports a full reload.
//
// @evidence contracts/testing.md#behavioral-verification Creating the types target dist/feature.d.ts in this nested export object reports reload, changed and a nonnil dump. The default's one-element array remains absent, so this does not certify array fallback selection or every leaf's freshness.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: a package subpath whose exports condition object (types, default array) has no existing targets starts unresolved, and creating the types target dist/feature.d.ts must yield mode reload, changed, with a dump. The new declaration's node is not asserted.
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
