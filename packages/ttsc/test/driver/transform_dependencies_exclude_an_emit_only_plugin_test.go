package driver_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// declaringProgramPlugin is a synthetic ProgramPlugin that touches nothing and
// declares its whole contribution complete, the way @ttsc/strip does.
type declaringProgramPlugin struct{}

func (declaringProgramPlugin) ApplyProgram(_ *driver.Program, ctx driver.PluginContext) error {
  ctx.ReportDependenciesComplete()
  return nil
}

// emitOnlyPlugin is a synthetic plugin whose only hook runs in the emit chain.
type emitOnlyPlugin struct{}

func (emitOnlyPlugin) EmitTransform(_ driver.PluginContext) (driver.PluginTransform, error) {
  return func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    return sf
  }, nil
}

// TestTransformDependenciesExcludeAnEmitOnlyPlugin Verifies that TransformDependenciesFor retains index.ts completeness beside an emit-only plugin.
//
// Declaring and emit-only hook classes coexist; silent transform contributors have separate coverage.
//
// 1. Register a declaring ProgramPlugin and an emit-only plugin and load the temporary project.
// 2. Request transform dependencies and assert index.ts remains complete.
//
// @evidence contracts/testing.md#behavioral-verification TransformDependenciesFor retains index.ts completeness beside an emit-only plugin.
// @evidence contracts/testing.md#independent-expectations Transform output does not execute EmitTransform, so that entry cannot veto the declaring ProgramPlugin.
// @evidence contracts/testing.md#distinguishing-cases Declaring and emit-only hook classes coexist; silent transform contributors have separate coverage.
// @evidence contracts/testing.md#execution-ownership Two synthetic Go plugins and one directly loaded Program execute without a sidecar build. Go discovers TestTransformDependenciesExcludeAnEmitOnlyPlugin under ./test/driver.
func TestTransformDependenciesExcludeAnEmitOnlyPlugin(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"declaring","stage":"transform","config":{}},{"name":"emitOnly","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(declaringProgramPlugin{})
  driver.RegisterPlugin(emitOnlyPlugin{})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  dependencies := prog.TransformDependenciesFor(root)

  if len(dependencies.Complete) != 1 || dependencies.Complete[0] != "index.ts" {
    t.Fatalf("expected the emit-only entry to leave the declaration standing, got %v", dependencies.Complete)
  }
}
