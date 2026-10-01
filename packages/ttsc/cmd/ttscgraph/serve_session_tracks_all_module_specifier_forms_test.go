package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionTracksAllModuleSpecifierForms verifies that every TypeScript
// syntax which can trigger module resolution contributes missing-file
// candidates to the freshness snapshot.
//
// 1. Load import-equals require, export-from, import-type and dynamic-import literals with missing targets.
// 2. Construct the resident session and inspect captured auxiliary candidates without requesting a snapshot.
// 3. Require legacy.ts, exported.ts, types.ts and lazy.ts to be tracked and missing.
//
// @evidence contracts/testing.md#behavioral-verification Require legacy.ts, exported.ts, types.ts and lazy.ts to be tracked and missing.
// @evidence contracts/testing.md#independent-expectations The literal fixture and the supported graph contract establish these expectations: Require legacy.ts, exported.ts, types.ts and lazy.ts to be tracked and missing.
// @evidence contracts/testing.md#distinguishing-cases Load import-equals require, export-from, import-type and dynamic-import literals with missing targets. Construct the resident session and inspect captured auxiliary candidates without requesting a snapshot. Require legacy.ts, exported.ts, types.ts and lazy.ts to be tracked and missing.
// @evidence contracts/testing.md#execution-ownership TestServeSessionTracksAllModuleSpecifierForms is a Go source-unit entry. newGraphSession and its captured auxiliary input state run directly; this constructor-only case requests no dump or shard publication. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestServeSessionTracksAllModuleSpecifierForms(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), `
import legacy = require("./legacy");
export { exported } from "./exported";
export type Deferred = import("./types").Deferred;
export const lazy = import("./lazy");
export const result = legacy();
`)

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()

  for _, name := range []string{"legacy.ts", "exported.ts", "types.ts", "lazy.ts"} {
    candidate := filepath.Join(root, "src", name)
    state, ok := session.auxStates[candidate]
    if !ok {
      t.Errorf("module candidate %s was not tracked", name)
    } else if state.Exists {
      t.Errorf("missing module candidate %s unexpectedly exists", name)
    }
  }
}
