package driver_test

import (
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitPluginTransformersSkipOutputsOutsideOutDir verifies the
// AST-integration emit lane confines its output to the project's outDir.
//
// Locks the outputEscapesOutDir guard in EmitWithPluginTransformers. This lane assembles tsgo's emit pipeline by hand, so it does not
// inherit any skip the raw Program.Emit path performs — the containment check
// must run on the per-file output paths it resolves itself. Without it, a
// plugin host's forced emit (e.g. typia's runBuild --emit) writes the
// self-referenced dependency's compiled `.js` into that dependency's source
// tree on every build.
//
//  1. Materialize the same self-referenced dependency layout as the EmitAllRaw
//     regression, with the project nested inside the package directory.
//  2. Load the project with ForceEmit and emit through
//     EmitWithPluginTransformers (no transforms).
//  3. Assert the project's main.js is written under outDir and no write
//     targets the dependency's source tree.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual EmitWithPluginTransformers for a self-referenced dependency layout, requiring main.js and every captured write inside project dist.
// @evidence contracts/testing.md#independent-expectations The authored outDir and project source independently define permitted paths, checked by a test-local prefix predicate.
// @evidence contracts/testing.md#distinguishing-cases Project output is required while dependency-source writes are forbidden; raw and rewrite-lane siblings own their separate emit funnels.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit runs compiler/emitter APIs directly on a private project with a local write list and deferred Program close rather than invoking a native host.
func TestEmitPluginTransformersSkipOutputsOutsideOutDir(t *testing.T) {
  root := t.TempDir()
  project := writeSelfReferencedDependencyProject(t, root)
  prog, diags, err := driver.LoadProgram(project, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  written := []string{}
  emitDiags, err := prog.EmitWithPluginTransformers(nil, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    written = append(written, fileName.AsString())
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  assertOutputsConfinedToOutDir(t, project, written)
}
