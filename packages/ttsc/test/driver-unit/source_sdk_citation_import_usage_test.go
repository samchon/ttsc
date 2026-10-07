package driver_test

import (
  "context"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/bundled"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/microsoft/typescript-go/shim/core"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  "github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// TestSourceSDKCitationImportUsage preserves the compiler-owned inline-link
// import-use distinction from the Evidence consumer fixture. Rules are absent:
// the public Program/checker owns this behavior, not the contributor graph.
//
// @evidence contracts/testing.md#behavioral-verification Parses the original type-only namespace import and braced/unbraced citation fixtures with noUnusedLocals, then runs actual public Program diagnostics. The braced source has no diagnostics; the unbraced source must report TS6133 against src/view.ts.
// @evidence contracts/testing.md#independent-expectations The language contract counts a resolved inline JSDoc link as a use while unknown-tag prose does not resolve that name. Literal zero diagnostics and code 6133 are authored expectations, not snapshots or diagnostics supplied by the implementation as an oracle.
// @evidence contracts/testing.md#distinguishing-cases The two inputs differ only by inline-link braces; both retain the same contracts.ISale namespace target, noUnusedLocals option and exported view. The negative original asserted TS6133 without independently requiring exit failure; this direct checker case retains that diagnostic assertion and also pins its source ownership.
// @evidence contracts/testing.md#execution-ownership This named driver-unit entry calls public compiler host, config, Program and diagnostic operations over two private t.TempDir input populations in one Go process. No consumer installation, plugin artifact build, native CLI or product host is needed; checker diagnostics are computed in process and no Evidence rule is substituted.
func TestSourceSDKCitationImportUsage(t *testing.T) {
  for _, fixture := range []struct {
    name, citation string
    unused         bool
  }{
    {"braced", "{@link contracts.ISale}", false},
    {"unbraced", "contracts.ISale", true},
  } {
    t.Run(fixture.name, func(t *testing.T) {
      root := t.TempDir()
      files := map[string]string{
        "tsconfig.json":    `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"noUnusedLocals":true},"files":["src/contracts.ts","src/view.ts"]}`,
        "src/contracts.ts": "export interface ISale {\n  price: number;\n}\n",
        "src/view.ts":      "import type * as contracts from \"./contracts.js\";\n\n/**\n * @evidence " + fixture.citation + " Renders the documented sale contract.\n */\nexport const view = (): void => {};\n",
      }
      for name, text := range files {
        file := filepath.Join(root, filepath.FromSlash(name))
        if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
          t.Fatal(err)
        }
        if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
          t.Fatal(err)
        }
      }
      fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
      host := shimcompiler.NewCompilerHost(root, fs, bundled.LibPath(), nil, nil)
      parsed, _ := tsoptions.GetParsedCommandLineOfConfigFile(filepath.Join(root, "tsconfig.json"), &core.CompilerOptions{}, nil, host, nil)
      if parsed == nil || len(parsed.Errors) != 0 {
        t.Fatalf("config parse failed: %#v", parsed)
      }
      program := shimcompiler.NewProgram(shimcompiler.ProgramOptions{Config: parsed, SingleThreaded: core.TSTrue, Host: host, UseSourceOfProjectReference: true})
      if program == nil {
        t.Fatal("NewProgram returned nil")
      }
      ctx := context.Background()
      diagnostics := append([]*shimast.Diagnostic{}, program.GetConfigFileParsingDiagnostics()...)
      diagnostics = append(diagnostics, program.GetSyntacticDiagnostics(ctx, nil)...)
      diagnostics = append(diagnostics, program.GetGlobalDiagnostics(ctx)...)
      diagnostics = append(diagnostics, program.GetSemanticDiagnostics(ctx, nil)...)
      if !fixture.unused {
        if len(diagnostics) != 0 {
          t.Fatalf("braced citation-only import produced diagnostics: %v", diagnostics)
        }
        return
      }
      for _, diagnostic := range diagnostics {
        if diagnostic.Code() == 6133 {
          if diagnostic.File() == nil || filepath.Clean(diagnostic.File().FileName()) != filepath.Join(root, "src", "view.ts") {
            t.Fatal("TS6133 belongs to the wrong source")
          }
          return
        }
      }
      t.Fatalf("unbraced citation-only import did not report TS6133: %v", diagnostics)
    })
  }
}
