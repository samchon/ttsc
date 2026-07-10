package driver_test

import (
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type applyErrorProgramPlugin struct{}

func (applyErrorProgramPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errLinkedApplyBoom
}

var errLinkedApplyBoom = &linkedApplyError{}

type linkedApplyError struct{}

func (*linkedApplyError) Error() string { return "linked apply boom" }

// TestEmitWithPluginTransformersPropagateLinkedApplyErrors verifies that a
// linked ProgramPlugin failure aborts the emit instead of being swallowed.
//
// EmitWithPluginTransformers is the first emit lane that runs linked
// ProgramPlugins itself, so its error path is new: a hook that fails must
// surface to the host (which reports emit failure) and must not let a
// half-mutated program emit as if nothing happened.
//
// 1. Register a linked ProgramPlugin whose ApplyProgram always errors.
// 2. Emit through EmitWithPluginTransformers.
// 3. Assert the emit returns that error and writes no output.
func TestEmitWithPluginTransformersPropagateLinkedApplyErrors(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"boom","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(applyErrorProgramPlugin{})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  emitted := map[string]string{}
  _, err = prog.EmitWithPluginTransformers(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[fileName] = text
    return nil
  })
  if err == nil || !strings.Contains(err.Error(), "linked apply boom") {
    t.Fatalf("expected linked apply error to abort emit, got err=%v", err)
  }
  if len(emitted) != 0 {
    t.Fatalf("emit produced output despite linked apply failure: %#v", emitted)
  }
}
