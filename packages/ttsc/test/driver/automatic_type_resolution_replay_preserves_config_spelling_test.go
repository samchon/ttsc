package driver_test

import (
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAutomaticTypeResolutionReplayPreservesConfigSpelling verifies stable
// automatic types keep the original config directory's lexical spelling.
//
// Automatic directives have a synthetic containing file and no SourceFile to
// recover its spelling from the compiler's canonical cache key. Secondary
// lookup must retain both resolved filenames and lexical package-link paths.
//
//  1. Load mixed-case projects with package, scoped, relative, primary,
//     wildcard, and unresolved types from a different working directory.
//  2. Repeat with a generated config and with a pnpm-shaped package link.
//  3. Assert exact containing filenames, unchanged replay and graph proofs,
//     and an ordinary source's independent type-reference context.
func TestAutomaticTypeResolutionReplayPreservesConfigSpelling(t *testing.T) {
  for _, wrapped := range []bool{false, true} {
    for _, linked := range []bool{false, true} {
      t.Run(fmt.Sprintf("wrapped=%t/linked=%t", wrapped, linked), func(t *testing.T) {
        workspace := t.TempDir()
        root := filepath.Join(workspace, "OwnerProject")
        cwd := filepath.Join(workspace, "OtherWorkingDirectory")
        if err := os.MkdirAll(cwd, 0o755); err != nil {
          t.Fatal(err)
        }
        writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "esnext", "moduleResolution": "bundler", "skipLibCheck": true,
    "types": ["*", "client-pkg", "client-pkg/client", "@scope/client-pkg/client", "./ambient/client", "missing-types"]
  },
  "files": ["index.ts", "nested/consumer.ts"]
}`)
        writeProjectFile(t, root, "index.ts", "export const value = true;\n")
        writeProjectFile(t, root, "nested/consumer.ts", "/// <reference types=\"client-pkg/client\" />\nexport const consumer = true;\n")
        writeProjectFile(t, root, "ambient/client.d.ts", "declare const relativeClient: string;\n")
        writeProjectFile(t, root, "node_modules/@types/primary/index.d.ts", "declare const primaryClient: string;\n")
        writeProjectFile(t, root, "node_modules/@scope/client-pkg/package.json", `{"name":"@scope/client-pkg","version":"1.0.0","exports":{"./client":"./client.d.ts"}}`)
        writeProjectFile(t, root, "node_modules/@scope/client-pkg/client.d.ts", "declare const scopedClient: string;\n")
        packageDirectory := "node_modules/client-pkg"
        if linked {
          packageDirectory = "node_modules/.pnpm/client-pkg@1.0.0/node_modules/client-pkg"
        }
        writeProjectFile(t, root, packageDirectory+"/package.json", `{"name":"client-pkg","version":"1.0.0","exports":{".":"./index.d.ts","./client":"./client.d.ts"}}`)
        writeProjectFile(t, root, packageDirectory+"/index.d.ts", "declare const rootClient: string;\n")
        writeProjectFile(t, root, packageDirectory+"/client.d.ts", "declare const packageClient: string;\n")
        if linked {
          target := filepath.Join(root, filepath.FromSlash(packageDirectory))
          link := filepath.Join(root, "node_modules", "client-pkg")
          if runtime.GOOS == "windows" {
            command := exec.Command("node", "-e", `require("node:fs").symlinkSync(process.argv[1], process.argv[2], "junction")`, target, link)
            if output, err := command.CombinedOutput(); err != nil {
              t.Fatalf("create package junction: %v: %s", err, output)
            }
          } else if err := os.Symlink(target, link); err != nil {
            t.Fatal(err)
          }
        }
        config := filepath.Join(root, "tsconfig.json")
        options := driver.LoadProgramOptions{ForceNoEmit: true}
        if wrapped {
          wrapper := filepath.Join(workspace, "GeneratedConfig")
          writeProjectFile(t, wrapper, "tsconfig.json", fmt.Sprintf(`{"extends":%q,"compilerOptions":{"strict":true}}`, filepath.ToSlash(config)))
          options.SemanticConfigPath = config
          config = filepath.Join(wrapper, "tsconfig.json")
        }
        prog, diagnostics, err := driver.LoadProgram(cwd, config, options)
        if err != nil || len(diagnostics) != 0 {
          t.Fatalf("load project: %v, %v", err, diagnostics)
        }
        defer prog.Close()
        automatic := map[string]bool{}
        ordinary := false
        for _, task := range shimcompiler.ProgramResolutionTasks(prog.TSProgram) {
          if task.Universal {
            automatic[task.Name] = true
            expected := filepath.ToSlash(filepath.Join(root, "__inferred type names__.ts"))
            if task.ContainingFile != expected {
              t.Errorf("%s containing file = %q, want %q", task.Name, task.ContainingFile, expected)
            }
            if (task.ResolvedFile == "") != (task.Name == "missing-types") {
              t.Errorf("%s resolved file = %q", task.Name, task.ResolvedFile)
            }
          } else if task.Kind == shimcompiler.ProgramResolutionKindTypeReference {
            ordinary = true
            expected := filepath.ToSlash(filepath.Join(root, "nested", "consumer.ts"))
            if task.ContainingFile != expected || task.SourceFile != expected {
              t.Errorf("ordinary reference lost its source context: %+v", task)
            }
          }
          if !shimcompiler.ReplayProgramResolutions([]shimcompiler.ProgramResolutionTask{task}, prog.FS) {
            t.Errorf("unchanged resolution failed: %+v", task)
          }
        }
        for _, name := range []string{"primary", "client-pkg", "client-pkg/client", "@scope/client-pkg/client", "./ambient/client", "missing-types"} {
          if !automatic[name] {
            t.Errorf("automatic resolution %q was not exercised", name)
          }
        }
        if !ordinary {
          t.Fatal("ordinary type reference was not exercised")
        }
        if graph := driver.NewTransformGraph(prog, root); len(graph.InputProofFailures) != 0 {
          t.Fatalf("unchanged graph proof failures: %v", graph.InputProofFailures)
        }
      })
    }
  }
}
