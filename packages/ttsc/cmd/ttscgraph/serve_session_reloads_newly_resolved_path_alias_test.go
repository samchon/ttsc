package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedPathAlias verifies a missing paths target
// is tracked even when it is excluded from the tsconfig root set.
//
// 1. Load @generated/value through paths while only src/index.ts is a configured root.
// 2. Create the excluded generated/value.ts target.
// 3. Require a changed reload dump containing generated.
//
// @evidence contracts/testing.md#behavioral-verification Creating the generated/value.ts target of a paths alias that is outside the configured root set reloads a resident session and the new dump contains generated.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: the @generated/* paths alias maps to generated/*, only src/index.ts is a root, and creating generated/value.ts must yield mode reload, changed, with a node named generated.
// @evidence contracts/testing.md#distinguishing-cases Load @generated/value through paths while only src/index.ts is a configured root. Create the excluded generated/value.ts target. Require a changed reload dump containing generated.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsNewlyResolvedPathAlias is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsNewlyResolvedPathAlias(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "baseUrl": ".",
    "paths": { "@generated/*": ["generated/*"] }
  },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { generated } from '@generated/value';\nexport function main(): void { generated(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "generated", "value.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export function generated(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "generated") {
    t.Fatalf("new paths target = dump:%v mode:%q changed:%v nodes:%#v", dump != nil, mode, changed, dump)
  }
}
