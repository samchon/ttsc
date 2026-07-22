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
// `ApplyLinkedPlugins` caches its outcome, and the emit path checks it — so
// `ttsc build` fails on such a project. The read-only paths did not: `SourceFile`,
// `SourceFiles`, and the graph builder all ran the apply and discarded the
// error, having no channel of their own. `ttscgraph` therefore described the
// untransformed program and said nothing, while the compiler on the same
// project reported the failure. Two halves of one toolchain disagreeing about
// whether the project is broken, with the quiet half the one an agent reads.
//
// `Diagnostics` is where it belongs: it already emits a driver-level entry with
// no file or code (`driver: nil program`), and every read-only consumer of a
// program's findings goes through it.
//
//  1. Register a linked plugin whose ApplyProgram fails.
//  2. Ask the program for its diagnostics.
//  3. Assert the failure is among them, as an error, and that the compiler's own
//     findings still follow it.
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

// TestDriverDiagnosticsStaySilentWhenPluginsApply is the negative twin: a
// project whose linked plugin applies cleanly reports exactly what the compiler
// found and nothing else, so the entry above is driven by the failure rather
// than by a plugin being linked at all.
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

  for _, diagnostic := range prog.Diagnostics() {
    if strings.Contains(diagnostic.Message, "linked plugins failed to apply") {
      t.Fatalf("a clean apply must report nothing: %s", diagnostic.Message)
    }
  }
}

type diagnosticsApplyOKPlugin struct{}

func (diagnosticsApplyOKPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return nil
}
