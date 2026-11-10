package main

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeReloadsCompilerArgumentInputs verifies native freshness retains
// response bytes and the argument base independently of project source edits.
//
// 1. Reuse unchanged arguments and ignore unrelated directory membership.
// 2. Reload after a same-length response edit and recover from a missing file.
// 3. Observe a retargeted argument-base link, while explicit empty args suppress it.
//
// @evidence contracts/testing.md#behavioral-verification Calls real graphSession loading and nextChange over actual response files; upstream strictNullChecks, Program identity and reload mode distinguish unchanged reuse, changed bytes, failure/repair and argument-base identity.
// @evidence contracts/testing.md#independent-expectations Authored true/false arguments prescribe native compiler options, and unchanged versus reload is the session contract. An unrelated file must not turn directory presence into membership watching.
// @evidence contracts/testing.md#distinguishing-cases Covers unchanged and same-length changed responses, a missing response and repair, a retargeted base for an inline relative option without response reads, and explicit empty suppression. Link coverage skips only if the actual filesystem refuses creating the link.
// @evidence contracts/testing.md#execution-ownership Portable Go source units own temporary projects, response files, restored transport variables and compiler sessions; no native executable or installed consumer starts. The link subcase removes its own link before directory cleanup and does not claim junction support where symlink creation was refused.
func TestServeReloadsCompilerArgumentInputs(t *testing.T) {
  setup := func(t *testing.T) (string, string, string) {
    t.Helper()
    root := t.TempDir()
    project, base := filepath.Join(root, "project"), filepath.Join(root, "arguments")
    for _, directory := range []string{project, base} {
      if err := os.MkdirAll(directory, 0755); err != nil {
        t.Fatal(err)
      }
    }
    if err := os.WriteFile(filepath.Join(project, "tsconfig.json"), []byte(`{"files":["main.ts"]}`), 0600); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filepath.Join(project, "main.ts"), []byte("export const value = 1;\n"), 0600); err != nil {
      t.Fatal(err)
    }
    response := filepath.Join(base, "args.rsp")
    if err := os.WriteFile(response, []byte("--strictNullChecks true \n"), 0600); err != nil {
      t.Fatal(err)
    }
    t.Setenv(driver.TsgoArgsEnv, `["@args.rsp"]`)
    t.Setenv(driver.TsgoArgsCwdEnv, base)
    return root, project, base
  }
  initialize := func(t *testing.T, session *graphSession) {
    t.Helper()
    t.Cleanup(func() { _ = session.compiler.Close() })
    if change, err := session.nextChange(false); err != nil || change == nil || change.mode != serveModeInitial {
      t.Fatalf("initial: %v / %v", change, err)
    }
    if change, err := session.nextChange(false); err != nil || change != nil {
      t.Fatalf("unchanged: %v / %v", change, err)
    }
  }
  t.Run("response", func(t *testing.T) {
    _, project, base := setup(t)
    session, err := newGraphSession(project, "tsconfig.json")
    if err != nil {
      t.Fatal(err)
    }
    initialize(t, session)
    first := session.compiler.Program()
    if err := os.WriteFile(filepath.Join(base, "unrelated.txt"), []byte("unrelated"), 0600); err != nil {
      t.Fatal(err)
    }
    if change, err := session.nextChange(false); err != nil || change != nil {
      t.Fatalf("directory membership invalidated arguments: %v / %v", change, err)
    }
    response := filepath.Join(base, "args.rsp")
    before, err := os.Stat(response)
    if err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(response, []byte("--strictNullChecks false\n"), 0600); err != nil {
      t.Fatal(err)
    }
    if err := os.Chtimes(response, before.ModTime(), before.ModTime()); err != nil {
      t.Fatal(err)
    }
    change, err := session.nextChange(false)
    if err != nil || change == nil || change.mode != serveModeReload || session.compiler.Program() == first || session.compiler.Program().ParsedConfig.CompilerOptions().StrictNullChecks.IsTrue() {
      t.Fatalf("response change reused the prior Program: %v / %v", change, err)
    }
    if change, err := session.nextChange(false); err != nil || change != nil {
      t.Fatalf("replacement not reusable: %v / %v", change, err)
    }
    if err := os.Remove(response); err != nil {
      t.Fatal(err)
    }
    if _, err := session.nextChange(false); err == nil {
      t.Fatal("missing response did not fail the load")
    }
    if err := os.WriteFile(response, []byte("--strictNullChecks true \n"), 0600); err != nil {
      t.Fatal(err)
    }
    if change, err := session.nextChange(false); err != nil || change == nil || change.mode != serveModeReload || !session.compiler.Program().ParsedConfig.CompilerOptions().StrictNullChecks.IsTrue() {
      t.Fatalf("response repair failed: %v / %v", change, err)
    }
  })
  t.Run("base-link", func(t *testing.T) {
    root, project, base := setup(t)
    second := filepath.Join(root, "second")
    if err := os.Mkdir(second, 0755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filepath.Join(second, "args.rsp"), []byte("--strictNullChecks true \n"), 0600); err != nil {
      t.Fatal(err)
    }
    alias := filepath.Join(root, "alias")
    if err := os.Symlink(base, alias); err != nil {
      t.Skipf("filesystem refused directory symlink: %v", err)
    }
    t.Cleanup(func() { _ = os.Remove(alias) })
    t.Setenv(driver.TsgoArgsEnv, `["--outDir","output"]`)
    t.Setenv(driver.TsgoArgsCwdEnv, alias)
    session, err := newGraphSession(project, "tsconfig.json")
    if err != nil {
      t.Fatal(err)
    }
    initialize(t, session)
    first := session.compiler.Program()
    if err := os.Remove(alias); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(second, alias); err != nil {
      t.Fatal(err)
    }
    if change, err := session.nextChange(false); err != nil || change == nil || change.mode != serveModeReload || session.compiler.Program() == first {
      t.Fatalf("base retarget reused the prior Program: %v / %v", change, err)
    }
  })
  t.Run("explicit-empty", func(t *testing.T) {
    _, project, base := setup(t)
    session, err := newGraphSessionWithArtifacts(project, "tsconfig.json", nil, driver.LoadProgramOptions{TsgoArgs: []string{}})
    if err != nil {
      t.Fatal(err)
    }
    initialize(t, session)
    if err := os.Remove(filepath.Join(base, "args.rsp")); err != nil {
      t.Fatal(err)
    }
    if change, err := session.nextChange(false); err != nil || change != nil {
      t.Fatalf("suppressed arguments affected freshness: %v / %v", change, err)
    }
  })
}
