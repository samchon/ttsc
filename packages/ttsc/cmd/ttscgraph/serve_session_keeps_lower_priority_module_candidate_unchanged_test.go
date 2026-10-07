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
// Directory index probes follow the selected direct JavaScript file, while
// value.mts is outside the automatic extension candidates for this import.
// Creating either must leave this snapshot unchanged; value.ts precedes the
// selected JavaScript file and must trigger the observed reload.
//
//  1. Load an extensionless commonjs import that resolves directly to value.js.
//  2. Create lower-priority value/index.ts and unselected-extension value.mts.
//  3. Assert the resident session remains unchanged, then create value.ts and
//     assert the strictly higher-priority candidate does reload it.
//
// @evidence contracts/testing.md#behavioral-verification Verifies a resident session does not reload when a candidate after its selected target appears.
// @evidence contracts/testing.md#independent-expectations For this extensionless commonjs import, the pinned resolver's direct-file list tries .ts before .js, reaches directory index probes only after direct-file failure, and does not add .mts to that extension list. Literal outcomes are unchanged with no dump after either index.ts or value.mts creation, then reload with typescriptWinner after value.ts creation. They distinguish these candidates, not every extension or resolution mode.
// @evidence contracts/testing.md#distinguishing-cases Resolve ./value to value.js; create the later directory index and the ineligible automatic .mts extension separately and require unchanged; create earlier value.ts and require reload with typescriptWinner.
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
