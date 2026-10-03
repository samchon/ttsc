package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsLowerPriorityModuleCandidateUnchanged verifies a
// resident session does not reload when a candidate after its selected target
// appears.
//
// Directory index probes are lower priority than every direct-file probe. An
// interleaved candidate list would turn the creation of an irrelevant index
// file into a full program reload and erase the bounded-freshness guarantee.
//
//  1. Load an extensionless commonjs import that resolves directly to value.js.
//  2. Create only lower-priority value/index.ts and value.mts candidates.
//  3. Assert the resident session remains unchanged, then create value.ts and
//     assert the strictly higher-priority candidate does reload it.
//
// @evidence contracts/testing.md#behavioral-verification Verifies a resident session does not reload when a candidate after its selected target appears.
// @evidence contracts/testing.md#independent-expectations The expected outcomes follow from TypeScript's commonjs extension and directory probe priority: with ./value resolving to value.js, creating value/index.ts and value.mts (lower priority in commonjs) must each be unchanged with no dump, and creating the higher-priority value.ts must be mode reload with a node named typescriptWinner.
// @evidence contracts/testing.md#distinguishing-cases Load an extensionless commonjs import that resolves directly to value.js; Create only lower-priority value/index.ts and value.mts candidates; Assert the resident session remains unchanged, then create value.ts and assert the strictly higher-priority candidate does reload it.
// @evidence contracts/testing.md#execution-ownership TestServeSessionKeepsLowerPriorityModuleCandidateUnchanged is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionKeepsLowerPriorityModuleCandidateUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "allowJs": true, "module": "commonjs", "target": "ES2022" },
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
  if err := os.MkdirAll(filepath.Join(root, "src", "value"), 0o755); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, filepath.Join(root, "src", "value", "index.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("lower-priority index = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "src", "value.mts"), "export function winner(): void {}\n")
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("commonjs-lower-priority .mts = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "src", "value.ts"), "export function winner(): void {}\nexport function typescriptWinner(): void {}\n")
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "typescriptWinner") {
    t.Fatalf("higher-priority .ts = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
