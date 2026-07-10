package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReusesUnchangedSnapshot verifies repeated graph requests do
// no graph rebuild when every project input is byte-identical.
//
// This is the hot MCP path. The native session still checks its config, root
// file set, and resident source hashes, but it must omit the dump so the Node
// server can retain its indexed maps without parsing or synthesizing them again.
//
// 1. Open a one-file graph session and request its initial dump.
// 2. Request another snapshot without touching the project.
// 3. Assert the second response is unchanged and carries no replacement dump.
func TestServeSessionReusesUnchangedSnapshot(t *testing.T) {
  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()

  first, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if first == nil || mode != "initial" || !changed {
    t.Fatalf("initial snapshot = dump:%v mode:%q changed:%v", first != nil, mode, changed)
  }

  second, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if second != nil || mode != "unchanged" || changed {
    t.Fatalf("unchanged snapshot = dump:%v mode:%q changed:%v", second != nil, mode, changed)
  }
}

func graphSessionFixture(t *testing.T) string {
  t.Helper()
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "export class BeforeEdit {}\n")
  return root
}
