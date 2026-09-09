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
// even when no source text changes, and a fresh Program must recover.
//
//  1. Load a mixed-case project with a resolved or missing package subpath.
//  2. Replace its exports target on disk between construction and replay.
//  3. Assert universal resolution failures and successful fresh compilation.
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
