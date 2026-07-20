package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsLowerPriorityPathsPatternUnchanged verifies only the
// most-specific TypeScript-Go paths pattern contributes freshness candidates.
//
// `@/special/*` outranks `@/*`; a file under the broad substitution never
// participates in this lookup, while a missing .ts sibling of the selected
// specific substitution does.
func TestServeSessionKeepsLowerPriorityPathsPatternUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "baseUrl": ".",
    "module": "commonjs",
    "paths": {
      "@/*": ["broad/*"],
      "@/special/*": ["specific/*"]
    },
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from '@/special/value';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "specific", "value.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "broad", "special", "value.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("broad paths pattern = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "specific", "value.ts"), "export function winner(): void {}\nexport function specificPathsWinner(): void {}\n")
  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "specificPathsWinner") {
    t.Fatalf("specific paths pattern = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
