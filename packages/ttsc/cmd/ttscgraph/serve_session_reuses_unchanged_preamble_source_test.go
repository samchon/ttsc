package main

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeSessionReusesUnchangedPreambleSource verifies injected compiler text
// is compared against the corresponding raw disk source, not mistaken for an
// edit on every snapshot.
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
