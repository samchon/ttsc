package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type diagnosticsApplyErrorPlugin struct{}

func (diagnosticsApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("apply boom")
}

// TestDriverDiagnosticsReportAFailedPluginApply verifies a linked plugin that
// fails to apply reaches a read-only consumer.
//
// `SourceFiles` runs the registered hook and retains its failure in the Program.
// `Diagnostics` reads that latched result alongside the compiler findings, so
// the fixture's semantic error remains visible beside the plugin failure.
// This unit does not invoke the build command or a graph consumer.
//
// `Diagnostics` does not initiate application. This case explicitly reads
// source files first; callers that have not triggered the hook cannot use this
// test as evidence that diagnostics forces it or that every consumer follows
// the same ordering.
//
//  1. Register a linked plugin whose ApplyProgram fails.
//  2. Read the program's source files to perform the registered hook.
//  3. Ask for diagnostics, and assert the failure is among them as an error,
//     with the compiler's own findings still beside it.
// @evidence contracts/testing.md#behavioral-verification Calls SourceFiles to perform the actual failing registered plugin application, then Diagnostics must expose apply boom as an error alongside at least one compiler diagnostic.
// @evidence contracts/testing.md#independent-expectations The authored plugin returns apply boom, while a literal string-to-number assignment independently owes a compiler error; neither expectation comes from the returned diagnostic list.
// @evidence contracts/testing.md#distinguishing-cases Plugin failure and a separate semantic error coexist, rejecting replacement of compiler findings by the plugin error; the adjacent clean-plugin entry is the negative control.
// @evidence contracts/testing.md#execution-ownership This owning driver Go unit runs an in-process registered plugin and Program, closes its Program and uses a test-scoped environment with a freshly reset registry; no built plugin or compiler host executes.
func TestDriverDiagnosticsReportAFailedPluginApply(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"diagnostics-apply-error","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(diagnosticsApplyErrorPlugin{})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["index.ts"]
}
`)
  // A real type error too, so the plugin entry is proven to sit alongside the
  // compiler's findings rather than replace them.
  writeProjectFile(t, root, "index.ts", `export const value: number = "not a number";
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected load diagnostics: %#v", diags)
  }
  defer prog.Close()

  // What a consumer does first, and what warms the cached apply outcome.
  _ = prog.SourceFiles()

  found := false
  typecheck := 0
  for _, diagnostic := range prog.Diagnostics() {
    if strings.Contains(diagnostic.Message, "apply boom") {
      found = true
      if !diagnostic.IsError() {
        t.Fatalf("a failed apply must be an error, got severity %v", diagnostic.Severity)
      }
      continue
    }
    if diagnostic.Code != 0 {
      typecheck++
    }
  }
  if !found {
    t.Fatalf("Diagnostics did not report the failed apply: %#v", prog.Diagnostics())
  }
  if typecheck == 0 {
    t.Fatal("the compiler's own diagnostics were lost alongside the plugin entry")
  }
}

// TestDriverDiagnosticsStaySilentWhenPluginsApply Verifies clean linked-plugin application
// adds no plugin diagnostic to compiler results.
//
// The failure-reporting companion registers a plugin that rejects application. This clean
// no-op plugin separates that failure from registration itself: an otherwise valid project
// must not acquire a diagnostic merely because its linked plugin ran.
//
// 1. Load the clean fixture and register the no-op plugin.
// 2. Call SourceFiles to apply it, then require the complete Diagnostics list to stay empty.
//
// @evidence contracts/testing.md#behavioral-verification Calls SourceFiles to apply a real registered no-op plugin and requires the complete Diagnostics list to be empty for the clean authored project.
// @evidence contracts/testing.md#independent-expectations A no-op ApplyProgram and valid exported numeric declaration independently owe no plugin or compiler diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Clean application contrasts the adjacent failing plugin plus compiler-error entry; the complete empty-list assertion rejects any spurious diagnostic, not only one error-message spelling.
// @evidence contracts/testing.md#execution-ownership This owning driver Go unit runs the actual in-process plugin and Program with test-scoped environment and a fresh registry, and closes its Program without a product process or installed plugin.
func TestDriverDiagnosticsStaySilentWhenPluginsApply(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"diagnostics-apply-ok","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(diagnosticsApplyOKPlugin{})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer prog.Close()

  _ = prog.SourceFiles()
  if diagnostics := prog.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("a clean project and plugin must report no diagnostics: %#v", diagnostics)
  }
}

type diagnosticsApplyOKPlugin struct{}

func (diagnosticsApplyOKPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return nil
}
