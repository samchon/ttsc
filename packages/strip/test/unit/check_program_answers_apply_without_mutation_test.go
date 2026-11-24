package strip_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/strip/test/internal/shared"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestCheckProgramAnswersApplyWithoutMutation verifies strip's CheckProgram
// returns ApplyProgram's analysis outcome and leaves the Program untouched, the
// contract that lets a resident check host keep strip's Program (#1864).
//
//  1. Load a Program with removable statements under the default strip config
//     and require CheckLinkedPlugins to succeed with the statements still
//     printed.
//  2. Repeat with an inline config key strip rejects and require
//     CheckLinkedPlugins to return the same error ApplyLinkedPlugins returns.
//
// @evidence contracts/testing.md#behavioral-verification Real Programs run CheckLinkedPlugins and ApplyLinkedPlugins; a CheckProgram that rewrote the AST leaves no debugger statement in the printed source, and one that diverged from ApplyProgram's config failure returns a different error.
// @evidence contracts/testing.md#independent-expectations The authored fixture text fixes what an unmutated print contains, and ApplyLinkedPlugins of an equivalent fresh Program is the oracle for the failure.
// @evidence contracts/testing.md#distinguishing-cases Owns the success and config-failure outcomes of CheckProgram; TestCommandRunsCheck owns the one-shot check command and the utility check-serve tests own residency.
// @evidence contracts/testing.md#execution-ownership A Go unit in the strip test package, whose driver import registers strip at registry index zero; the linked manifest is set with t.Setenv and no host binary runs.
func TestCheckProgramAnswersApplyWithoutMutation(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root := seedStripProject(t, false)
  load := func(manifest string) *driver.Program {
    t.Helper()
    t.Setenv(driver.LinkedPluginsEnv, manifest)
    prog, diags, err := driver.LoadProgram(root, filepath.Join(root, "tsconfig.json"), driver.LoadProgramOptions{ForceNoEmit: true})
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("load: %v %v", err, diags)
    }
    t.Cleanup(func() { _ = prog.Close() })
    return prog
  }

  clean := load(stripManifest(t))
  if err := clean.CheckLinkedPlugins(); err != nil {
    t.Fatalf("CheckLinkedPlugins: %v", err)
  }
  if clean.HasMutatingLinkedCheckPlugins() {
    t.Fatal("strip must answer the check without mutation")
  }
  source := clean.TSProgram.GetSourceFile(filepath.ToSlash(filepath.Join(root, "src", "main.ts")))
  if source == nil {
    t.Fatal("main.ts missing from the Program")
  }
  printed := shimprinter.EmitSourceFile(shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, nil), source)
  if !strings.Contains(printed, "debugger") || !strings.Contains(printed, "console.log") {
    t.Fatalf("CheckProgram mutated the source:\n%s", printed)
  }

  rejected := shared.MustJSON(t, []map[string]any{{
    "name":   "@ttsc/strip",
    "stage":  "transform",
    "config": map[string]any{"transform": "@ttsc/strip", "calls": []string{"console.log"}},
  }})
  checked := load(rejected).CheckLinkedPlugins()
  applied := load(rejected).ApplyLinkedPlugins()
  if checked == nil || applied == nil || checked.Error() != applied.Error() {
    t.Fatalf("CheckProgram %v differs from ApplyProgram %v", checked, applied)
  }
}
