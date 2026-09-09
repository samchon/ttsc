package driver_test

import (
  "fmt"
  "path/filepath"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAutomaticTypeResolutionReplayPreservesCwdWithoutConfig verifies the
// configless compiler API retains cwd spelling for automatic type directives.
//
// Embedders can create a Program without ConfigFilePath. Its automatic types
// resolve relative to cwd, while an explicit empty types list creates no tasks.
//
//  1. Parse a project and use its options as a configless Program input.
//  2. Load a package subpath from a mixed-case cwd and replay its resolution.
//  3. Assert exact context and successful replay, including the empty control.
func TestAutomaticTypeResolutionReplayPreservesCwdWithoutConfig(t *testing.T) {
  for _, types := range []string{`["client-pkg/client"]`, `[]`} {
    t.Run(types, func(t *testing.T) {
      root := filepath.Join(t.TempDir(), "ConfiglessProject")
      writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"module":"esnext","moduleResolution":"bundler","types":%s},"files":["index.ts"]}`, types))
      writeProjectFile(t, root, "index.ts", "export const value = true;\n")
      writeProjectFile(t, root, "node_modules/client-pkg/package.json", `{"name":"client-pkg","version":"1.0.0","exports":{"./client":"./client.d.ts"}}`)
      writeProjectFile(t, root, "node_modules/client-pkg/client.d.ts", "declare const client: string;\n")
      root = filepath.ToSlash(root)
      filesystem := driver.DefaultFS()
      host := driver.DefaultHost(root, filesystem)
      parsed, diagnostics, err := driver.ParseTSConfig(filesystem, root, "tsconfig.json", host, nil)
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("parse config: %v, %v", err, diagnostics)
      }
      parsed.ParsedConfig.CompilerOptions.ConfigFilePath = ""
      prog, diagnostics, err := driver.CreateProgramFromConfig(parsed, host)
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("create configless program: %v, %v", err, diagnostics)
      }
      tasks := shimcompiler.ProgramResolutionTasks(prog)
      if types == `[]` {
        if len(tasks) != 0 {
          t.Fatalf("empty types produced resolutions: %+v", tasks)
        }
        return
      }
      if len(tasks) != 1 || !tasks[0].Universal || tasks[0].ResolvedFile == "" {
        t.Fatalf("expected one resolved automatic type: %+v", tasks)
      }
      if expected := root + "/__inferred type names__.ts"; tasks[0].ContainingFile != expected {
        t.Fatalf("containing file = %q, want %q", tasks[0].ContainingFile, expected)
      }
      if !shimcompiler.ReplayProgramResolutions(tasks, filesystem) {
        t.Fatal("unchanged configless resolution did not replay")
      }
    })
  }
}
