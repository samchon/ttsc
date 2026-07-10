package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsMissingLiteralRootUnchanged verifies a permanently
// absent `files` entry does not churn the session.
//
// The negative twin of the created-literal-root reload: tracking a missing
// root as a freshness input must record a stable absent state. If the stored
// parse-time root set and the reloaded one disagreed about missing literal
// entries, or the absent state flapped, every snapshot would degrade into a
// full reload and silently erase the resident session's entire benefit.
//
//  1. Open a session whose tsconfig lists absent `src/generated.ts` in files.
//  2. Take repeated snapshots without touching the project.
//  3. Assert each one reports unchanged with no replacement dump.
func TestServeSessionKeepsMissingLiteralRootUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts", "src/generated.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export class Present {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  for i := 0; i < 2; i++ {
    dump, mode, changed, err := session.Snapshot()
    if err != nil {
      t.Fatal(err)
    }
    if dump != nil || mode != "unchanged" || changed {
      t.Fatalf("iteration %d: missing literal root churned = dump:%v mode:%q changed:%v", i, dump != nil, mode, changed)
    }
  }
}
