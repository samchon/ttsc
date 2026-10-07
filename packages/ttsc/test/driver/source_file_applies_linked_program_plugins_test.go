package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestSourceFileAppliesLinkedProgramPlugins Verifies that Program.SourceFile
// runs linked ProgramPlugin hooks before handing out the single file.
//
// This is the single-file lane of the linked-plugin funnel: a host's `--file` transform mode fetches one source through SourceFile and
// prints it, so if only SourceFiles applied linked plugins, a whole-project
// run and a single-file run of the same host would disagree about the tree.
//
//  1. Register a linked ProgramPlugin that rewrites "linked-pending" into
//     "linked-applied" and pair it with one manifest entry.
//  2. Fetch index.ts via Program.SourceFile; only the hook traverses SourceFiles.
//  3. Print the returned file and assert the linked rewrite is present.
//
// @evidence contracts/testing.md#behavioral-verification Program.SourceFile returns a tree with linked-applied and without linked-pending.
// @evidence contracts/testing.md#independent-expectations The stub owns two distinct literals, so old-value absence detects missed hooks.
// @evidence contracts/testing.md#distinguishing-cases The host fetches only SourceFile; the registered hook itself traverses SourceFiles to rewrite literals. Whole-program host access has separate coverage.
// @evidence contracts/testing.md#execution-ownership Go unit TestSourceFileAppliesLinkedProgramPlugins is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestSourceFileAppliesLinkedProgramPlugins(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
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
