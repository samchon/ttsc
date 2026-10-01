package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsBaseURLFallbackUnchanged verifies an unmatched
// baseUrl-style file does not invalidate a paths resolution.
//
// The pinned TypeScript-Go resolver applies a matching paths substitution and
// does not fall back to baseUrl afterward. Recording a baseUrl probe would make
// an irrelevant file creation rebuild a resident session without changing the
// selected module.
//
//  1. Load a paths import whose configured fallback target exists.
//  2. Create only the corresponding baseUrl-style file.
//  3. Assert the session remains unchanged because the paths target still wins.
//
// @evidence contracts/testing.md#behavioral-verification Verifies an unmatched baseUrl-style file does not invalidate a paths resolution.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish the session remains unchanged because the paths target still wins.
// @evidence contracts/testing.md#distinguishing-cases Load a paths import whose configured fallback target exists; Create only the corresponding baseUrl-style file; Assert the session remains unchanged because the paths target still wins.
// @evidence contracts/testing.md#execution-ownership TestServeSessionKeepsBaseURLFallbackUnchanged is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionKeepsBaseURLFallbackUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "baseUrl": ".",
    "module": "commonjs",
    "paths": { "@generated/*": ["fallback/*"] },
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from '@generated/value';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "fallback", "value.ts"), "export function winner(): void {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, filepath.Join(root, "@generated", "value.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("baseUrl fallback = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
