package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionToleratesOsInvalidResolutionCandidate verifies unresolved
// module specifiers that name OS-unparseable paths never break the session.
//
// Bundler-style specifiers (`./style.css?inline`) and URL imports (`data:`)
// stay unresolved in tsgo and become freshness candidates. On Windows those
// candidate paths fail os.ReadFile with ERROR_INVALID_NAME, which is neither
// ErrNotExist nor ErrInvalid; treating that as a snapshot error would make
// every graph request fail forever on such a project.
//
//  1. Open a session whose only root imports a query-suffixed CSS path and a
//     data: URL.
//  2. Assert the session initializes and serves its initial dump.
//  3. Assert an untouched second snapshot reports unchanged.
func TestServeSessionToleratesOsInvalidResolutionCandidate(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "index.ts"), `
// @ts-expect-error bundler-only specifier stays unresolved for tsgo
import styles from "./style.css?inline";
// @ts-expect-error data: URLs resolve at runtime, not through the compiler
import remote from "data:text/plain,hello";
export const value: unknown[] = [styles, remote];
`)

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()

  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "initial" || !changed {
    t.Fatalf("initial snapshot = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != "unchanged" || changed {
    t.Fatalf("untouched snapshot = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
