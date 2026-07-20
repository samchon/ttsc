package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsExportsBlockedFileCandidatesUnchanged verifies a
// package export map prevents unlisted bare-file candidates from invalidating a
// resident session.
//
// An export map controls subpath resolution before TypeScript considers an
// on-disk package file. Recording that blocked file as a predecessor would make
// unrelated package contents churn the snapshot despite the selected export
// remaining exactly the same.
//
//  1. Load a package subpath resolved through its export-map fallback target.
//  2. Create an unlisted file at the bare subpath without changing package.json.
//  3. Assert the session is unchanged, then create the export-map target that
//     genuinely precedes the fallback and assert it reloads.
func TestServeSessionKeepsExportsBlockedFileCandidatesUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from 'fixture-package/feature';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "exports": { "./feature": ["./dist/first.js", "./dist/fallback.js"] }
}`)
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "fallback.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "feature.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("exports-blocked feature.ts = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "first.js"), "export function winner() {}\nexport function exportsWinner() {}\n")
  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "exportsWinner") {
    t.Fatalf("export-map first target = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
