package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/microsoft/typescript-go/shim/bundled"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAutomaticTypeResolutionReplayRejectsChangedTargets verifies restoring
// lexical context does not authorize genuinely changed automatic types.
//
// One automatic type contributes to the entire Program. Changing its target
// or resolving a formerly missing type must still invalidate every source,
// even when no source text changes, and a fresh Program's graph proof must recover.
//
//  1. Load a mixed-case project with a resolved or missing package subpath.
//  2. Replace its exports target on disk between construction and replay.
//  3. Assert universal resolution failures and a fresh graph with no proof failures.
//
// @evidence contracts/testing.md#behavioral-verification Constructs actual programs and transform graphs before and after changing a package target; both authored source nodes must exist and report resolution-changed, as must every returned source edge. A fresh graph must have no proof failures; this does not emit output or assert complete semantic diagnostics.
// @evidence contracts/testing.md#independent-expectations Authored original and replacement declarations establish changed identity, and literal resolution-changed defines rejection independently of the graph implementation.
// @evidence contracts/testing.md#distinguishing-cases Previously resolved retargeting and previously missing appearance both require universal invalidation; initial and fresh graph controls require empty failures.
// @evidence contracts/testing.md#execution-ownership The owning Go unit invokes actual compiler and graph operations with uncached disk reads, private t.TempDir input and registered program cleanup; it launches no compiler process.
func TestAutomaticTypeResolutionReplayRejectsChangedTargets(t *testing.T) {
  for _, initiallyMissing := range []bool{false, true} {
    name := "changed target"
    if initiallyMissing {
      name = "appearing target"
    }
    t.Run(name, func(t *testing.T) {
      root := filepath.Join(t.TempDir(), "ChangingProject")
      writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"esnext","moduleResolution":"bundler","types":["client-pkg/client"]},"files":["index.ts","sibling.ts"]}`)
      writeProjectFile(t, root, "index.ts", "export const value = true;\n")
      writeProjectFile(t, root, "sibling.ts", "export const sibling = true;\n")
      if !initiallyMissing {
        writeProjectFile(t, root, "node_modules/client-pkg/package.json", `{"name":"client-pkg","version":"1.0.0","exports":{"./client":"./original.d.ts"}}`)
        writeProjectFile(t, root, "node_modules/client-pkg/original.d.ts", "declare const original: string;\n")
      }
      load := func() *driver.Program {
        t.Helper()
        // Replay must see the new disk state, not a resident filesystem cache.
        prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
          ForceNoEmit: true,
          FS:          bundled.WrapFS(osvfs.FS()),
        })
        if err != nil || len(diagnostics) != 0 {
          t.Fatalf("load project: %v, %v", err, diagnostics)
        }
        t.Cleanup(func() { prog.Close() })
        return prog
      }
      prog := load()
      if graph := driver.NewTransformGraph(prog, root); len(graph.InputProofFailures) != 0 {
        t.Fatalf("stable initial replay failed: %v", graph.InputProofFailures)
      }
      writeProjectFile(t, root, "node_modules/client-pkg/package.json", `{"name":"client-pkg","version":"1.0.0","exports":{"./client":"./replacement.d.ts"}}`)
      writeProjectFile(t, root, "node_modules/client-pkg/replacement.d.ts", "declare const replacement: number;\n")
      graph := driver.NewTransformGraph(prog, root)
      for _, source := range []string{"index.ts", "sibling.ts"} {
        if _, present := graph.Edges[source]; !present {
          t.Errorf("authored source %q is missing from the changed graph", source)
        }
        if failure := graph.InputProofFailures[source]; failure != "resolution-changed" {
          t.Errorf("authored automatic type failure for %q = %q", source, failure)
        }
      }
      for source := range graph.Edges {
        if failure := graph.InputProofFailures[source]; failure != "resolution-changed" {
          t.Errorf("changed automatic type failure for %q = %q", source, failure)
        }
      }
      if graph := driver.NewTransformGraph(load(), root); len(graph.InputProofFailures) != 0 {
        t.Fatalf("fresh program did not recover: %v", graph.InputProofFailures)
      }
    })
  }
}
