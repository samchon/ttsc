package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsModuleSuffixCandidate verifies a configured module
// suffix is considered before the unsuffixed extension candidate.
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
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "src", "value.native.ts"), "export function winner(): void {}\nexport function nativeWinner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "nativeWinner") {
    t.Fatalf("module-suffix candidate = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
