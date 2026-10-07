package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionToleratesOsInvalidResolutionCandidate verifies initial and
// unchanged snapshots for two authored unresolved query and URL specifiers.
//
// These specifiers exercise resolution freshness inputs that may be unusable
// as native paths. The actual capture treats unreadable, non-directory inputs
// as absent. This unit checks snapshot success on the running platform; it
// does not assert a particular native error code or candidate-read failure.
//
//  1. Open a session whose only root imports a query-suffixed CSS path and a
//     data: URL.
//  2. Assert the session initializes and serves its initial dump.
//  3. Assert an untouched second snapshot reports unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Verifies successful initial and untouched unchanged snapshots for the authored query-suffixed CSS and data URL imports. Other specifiers, native error codes, and future requests are not certified.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: with authored ./style.css?inline and data: specifiers, the first snapshot must succeed as mode initial, changed, with a dump, and a second snapshot over the untouched project must be mode unchanged with no dump. A candidate-read error is not independently observed, so success does not certify Windows invalid-name handling on every platform.
// @evidence contracts/testing.md#distinguishing-cases Open a session whose only root imports a query-suffixed CSS path and a data: URL; Assert the session initializes and serves its initial dump; Assert an untouched second snapshot reports unchanged.
// @evidence contracts/testing.md#execution-ownership TestServeSessionToleratesOsInvalidResolutionCandidate is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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

  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "initial" || !changed {
    t.Fatalf("initial snapshot = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != "unchanged" || changed {
    t.Fatalf("untouched snapshot = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
