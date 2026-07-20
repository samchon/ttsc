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
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, filepath.Join(root, "@generated", "value.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("baseUrl fallback = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
