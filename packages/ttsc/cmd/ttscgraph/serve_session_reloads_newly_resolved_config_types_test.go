package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedConfigTypes verifies compilerOptions
// `types` entries participate in freshness without any source-level syntax.
//
// A `types` package is requested by the config alone, so no triple-slash
// directive or import exists to contribute resolution candidates. Generated
// typeRoots packages appear without touching package.json or the lockfile,
// which would leave the graph permanently blind to them.
//
//  1. Open a session whose config lists absent types package `fixture-types`.
//  2. Create the package under the configured typeRoots directory.
//  3. Assert the next snapshot reports a full reload.
func TestServeSessionReloadsNewlyResolvedConfigTypes(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "typeRoots": ["./types"], "types": ["fixture-types"] },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export const value = 1;\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "types", "fixture-types", "index.d.ts"), "interface FixtureType { id: number }\n")
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed {
    t.Fatalf("new config types package = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
