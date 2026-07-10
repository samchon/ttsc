package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionTracksAllModuleSpecifierForms verifies that every TypeScript
// syntax which can trigger module resolution contributes missing-file
// candidates to the freshness snapshot.
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
export const common = require("./common");
export const result = legacy();
`)

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()

  for _, name := range []string{"legacy.ts", "exported.ts", "types.ts", "lazy.ts", "common.ts"} {
    candidate := filepath.Join(root, "src", name)
    state, ok := session.auxStates[candidate]
    if !ok {
      t.Errorf("module candidate %s was not tracked", name)
    } else if state.Exists {
      t.Errorf("missing module candidate %s unexpectedly exists", name)
    }
  }
}
