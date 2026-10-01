package main

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeSessionReusesUnchangedPreambleSource verifies injected compiler text
// is compared against the corresponding raw disk source, not mistaken for an
// edit on every snapshot.
//
// 1. Load index.ts with an injected SourcePreamble and capture its raw disk identity.
// 2. Request a snapshot from initialized state without another disk edit.
// 3. Require unchanged with no dump; injected resident text must not be mistaken for a disk edit.
//
// @evidence contracts/testing.md#behavioral-verification Require unchanged with no dump; injected resident text must not be mistaken for a disk edit.
// @evidence contracts/testing.md#independent-expectations The literal fixture and supported graph contract establish these expectations: Require unchanged with no dump; injected resident text must not be mistaken for a disk edit.
// @evidence contracts/testing.md#distinguishing-cases Load index.ts with an injected SourcePreamble and capture its raw disk identity. Request a snapshot from initialized state without another disk edit. Require unchanged with no dump; injected resident text must not be mistaken for a disk edit.
// @evidence contracts/testing.md#execution-ownership TestServeSessionReusesUnchangedPreambleSource is a Go source-unit entry. driver.NewSession, captureState and the actual Snapshot facade run directly; the initialized unchanged branch returns before graph preparation or Git acquisition. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestServeSessionReusesUnchangedPreambleSource(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"strict":true},"files":["index.ts"]}`)
  writeGraphFile(t, filepath.Join(root, "index.ts"), "export const value = 1;\n")

  compiler, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{
    SourcePreamble: "declare const injected: number;\n",
  })
  if err != nil {
    t.Fatal(err)
  }
  if compiler == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  session := &graphSession{
    cwd:         root,
    tsconfig:    "tsconfig.json",
    compiler:    compiler,
    initialized: true,
  }
  defer session.Close()
  if err := session.captureState(); err != nil {
    t.Fatal(err)
  }

  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != "unchanged" || changed {
    t.Fatalf("unchanged preamble source = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
