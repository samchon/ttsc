package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsNonLongestRootDirsCandidateUnchanged verifies rootDirs
// starts from TypeScript-Go's longest matching source root.
//
// The containing source lies under both src and src/generated. Only the
// longest root makes out/views/template a peer candidate; out/generated/views
// comes from the shorter root and is never tried by this resolution.
func TestServeSessionKeepsNonLongestRootDirsCandidateUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "commonjs",
    "rootDirs": ["src", "src/generated", "out"],
    "target": "ES2022"
  },
  "files": ["src/generated/views/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "generated", "views", "main.ts"), "import { winner } from './template';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "out", "views", "template.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "out", "generated", "views", "template.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("non-longest rootDirs candidate = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "src", "views", "template.ts"), "export function winner(): void {}\nexport function rootDirsWinner(): void {}\n")
  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "rootDirsWinner") {
    t.Fatalf("longest-root peer candidate = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
