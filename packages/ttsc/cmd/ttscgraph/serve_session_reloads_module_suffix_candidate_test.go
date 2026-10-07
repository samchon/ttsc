package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsModuleSuffixCandidate verifies the configured .native
// TypeScript candidate replaces the selected unsuffixed JavaScript fallback.
//
// 1. Load a value.js fallback with moduleSuffixes selecting .native before the empty suffix.
// 2. Create value.native.ts.
// 3. Require a reload containing nativeWinner.
//
// @evidence contracts/testing.md#behavioral-verification With moduleSuffixes [.native, ”], creating value.native.ts beside the resolved value.js reloads a resident session and the new dump contains nativeWinner.
// @evidence contracts/testing.md#independent-expectations moduleSuffixes includes .native, and TypeScript file candidates precede JavaScript fallback candidates. Literal outcomes after src/value.native.ts creation are reload, changed and nativeWinner. This fixture has no competing value.ts, so it does not distinguish reversal of the two suffixes within the same extension.
// @evidence contracts/testing.md#distinguishing-cases Load a value.js fallback with moduleSuffixes selecting .native before the empty suffix. Create value.native.ts. Require a reload containing nativeWinner.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReloadsModuleSuffixCandidate is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionReloadsModuleSuffixCandidate(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "commonjs",
    "moduleSuffixes": [".native", ""],
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from './value';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "src", "value.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "src", "value.native.ts"), "export function winner(): void {}\nexport function nativeWinner(): void {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "nativeWinner") {
    t.Fatalf("module-suffix candidate = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
