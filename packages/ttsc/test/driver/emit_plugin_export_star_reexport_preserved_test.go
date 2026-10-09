package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerExportStarReexportPreserved Verifies a wildcard re-export
// retains its CommonJS helper and dependency require after transformation.
//
// Rebuilding the source file around a sibling can lose a re-export if its original parent
// identity is disturbed. The helper call and dependency require are checked together so
// retaining the transformed sibling alone cannot hide a dropped wildcard export.
//
// 1. Transform the wildcard-reexport fixture sibling initializer to 7.
// 2. Require the wildcard helper and dependency require alongside exports.local = 7.
//
// @evidence contracts/testing.md#behavioral-verification Calls the real transform emitter and requires wildcard export helper and require target along with literal sibling exports.local = 7.
// @evidence contracts/testing.md#independent-expectations Authored wildcard ./dep export and independent replacement seven define expected generated structures.
// @evidence contracts/testing.md#distinguishing-cases Unchanged wildcard export and changed local value in one source distinguish retained module lowering from skipped plugin work.
// @evidence contracts/testing.md#execution-ownership The owning driver unit runs its actual in-process visitor and compiler with a disposable Program, local write map and deferred close; no executable artifact is consumed.
func TestEmitWithPluginTransformerExportStarReexportPreserved(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["dep.ts","index.ts"]}`)
  writeProjectFile(t, root, "dep.ts", "export const helper = (x: number): number => x + 1;\n")
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    "export * from \"./dep\";",
    "export const local: number = 0;",
    "",
  }, "\n"))
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rewrite only the `local` initializer; the export-star is untouched.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        return ec.Factory.NewNumericLiteral("7", 0)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)

  // The wildcard re-export must lower to the __exportStar helper.
  if !strings.Contains(js, "__exportStar(") {
    t.Fatalf("`export * from` lost its __exportStar lowering:\n%s", js)
  }
  if !strings.Contains(js, `require("./dep")`) {
    t.Fatalf("__exportStar did not retain its require(\"./dep\") target:\n%s", js)
  }
  // The unrelated plugin rewrite still landed.
  if !strings.Contains(js, "exports.local = 7;") {
    t.Fatalf("plugin sibling rewrite (0 -> 7) did not emit:\n%s", js)
  }
}
