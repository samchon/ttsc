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

// TestTransformDependenciesExcludeAnEmitOnlyPlugin verifies which linked entries
// the host counts as transform contributors.
//
// The classification decides whether one silent plugin blocks every declaration
// in the envelope, and it is the half of the aggregation that reads the
// process-wide plugin registry, so it needs a real program rather than a
// hand-built state. An `EmitTransform` runs in the `build` lane, which emits no
// envelope, so an entry that implements only that hook cannot influence a
// transform output and must not withhold the declaring plugin's claim.
func TestTransformDependenciesExcludeAnEmitOnlyPlugin(t *testing.T) {
  resetLinkedPluginRegistry()
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
