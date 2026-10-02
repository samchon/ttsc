package driver_test

import (
  "path/filepath"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitAllSkipsOutputsOutsideOutDir verifies the rewrite-pipeline emit lane
// confines its output to the project's outDir.
//
// Locks the outputEscapesOutDir guard in the emit() WriteFile funnel shared by
// EmitAll and EmitFile (issue #293). This funnel is a separate code path from
// EmitAllRaw's — a regression could drop the guard from one funnel while the
// other keeps it — so the rewrite lane pins its own containment against the
// same self-referenced dependency layout.
//
//  1. Materialize the self-referenced dependency layout with the project
//     nested inside the package directory.
//  2. Load the project with ForceEmit and emit through EmitAll with an empty
//     rewrite set.
//  3. Assert the project's main.js is written under outDir and no write
//     targets the dependency's source tree.
// @evidence contracts/testing.md#behavioral-verification Calls actual EmitAll on a self-referenced dependency project, records every write and requires main.js under the authored dist plus confinement of all writes.
// @evidence contracts/testing.md#independent-expectations The fixture explicitly sets proj/dist and src/main.ts; test-local prefix checks independently reject any output outside that directory.
// @evidence contracts/testing.md#distinguishing-cases Project output remains positive while external dependency source outputs are rejected; the sibling raw-emitter case owns the separate funnel.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit loads and closes an in-process Program and captures write callbacks on its private fixture without executing a product binary.
func TestEmitAllSkipsOutputsOutsideOutDir(t *testing.T) {
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
  _, emitDiags, err := prog.EmitAll(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    written = append(written, filepath.ToSlash(fileName))
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
