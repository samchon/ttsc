package main

import (
  "os"
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
// @evidence contracts/testing.md#behavioral-verification A session whose compiler was created with a SourcePreamble does not treat the injected resident text as a disk edit: a snapshot with no disk change returns unchanged with no dump.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: the resident source text includes an injected declaration the disk file lacks, yet with the disk untouched Snapshot must return mode unchanged, not changed, with no dump. A comparison of raw resident text against raw disk bytes would report an edit.
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
  resident, ok := compiler.SourceText(filepath.Join(root, "index.ts"))
  if !ok || resident != "declare const injected: number;\nexport const value = 1;\n" {
    t.Fatalf("resident source lacks the literal injected preamble: found=%v text=%q", ok, resident)
  }
  disk, err := os.ReadFile(filepath.Join(root, "index.ts"))
  if err != nil {
    t.Fatal(err)
  }
  if string(disk) != "export const value = 1;\n" {
    t.Fatalf("disk source changed during preamble load: %q", disk)
  }
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
