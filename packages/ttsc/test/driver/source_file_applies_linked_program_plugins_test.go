package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestSourceFileAppliesLinkedProgramPlugins verifies that Program.SourceFile
// runs linked ProgramPlugin hooks before handing out the single file.
//
// Locks the single-file lane of the same class as the emit-funnel regression:
// a host's `--file` transform mode fetches one source through SourceFile and
// prints it, so if only SourceFiles applied linked plugins, a whole-project
// run and a single-file run of the same host would disagree about the tree.
//
//  1. Register a linked ProgramPlugin that rewrites "linked-pending" into
//     "linked-applied" and pair it with one manifest entry.
//  2. Fetch index.ts via Program.SourceFile (never calling SourceFiles).
//  3. Print the returned file and assert the linked rewrite is present.
func TestSourceFileAppliesLinkedProgramPlugins(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"rewrite","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(&stringRewriteProgramPlugin{from: "linked-pending", to: "linked-applied"})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const spec = \"linked-pending\";\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  file := prog.SourceFile(filepath.Join(root, "index.ts"))
  if file == nil {
    t.Fatal("index.ts not found in program")
  }
  printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, nil)
  text := shimprinter.EmitSourceFile(printer, file)
  t.Logf("index.ts:\n%s", text)

  if !strings.Contains(text, "linked-applied") {
    t.Fatalf("linked ProgramPlugin did not apply on the SourceFile lane:\n%s", text)
  }
  if strings.Contains(text, "linked-pending") {
    t.Fatalf("stale literal survived the linked rewrite:\n%s", text)
  }
}
