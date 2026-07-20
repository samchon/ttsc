package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsESMDirectoryCandidateUnchanged verifies ESM relative
// resolution does not inherit CommonJS directory probes.
//
// TypeScript-Go may substitute value.ts for the explicit value.js import, but
// it never performs the CommonJS value/package.json or value/index.* lookup in
// ESM mode. Those directory members must therefore stay out of a resident
// session's freshness inputs.
func TestServeSessionKeepsESMDirectoryCandidateUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "package.json"), `{"type":"module"}`)
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from './value.js';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "src", "value.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  if err := os.MkdirAll(filepath.Join(root, "src", "value"), 0o755); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, filepath.Join(root, "src", "value", "package.json"), `{"type":"module"}`)
  writeGraphFile(t, filepath.Join(root, "src", "value", "index.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("ESM directory candidate = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "src", "value.ts"), "export function winner(): void {}\nexport function typescriptWinner(): void {}\n")
  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "typescriptWinner") {
    t.Fatalf("ESM higher-priority file = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
