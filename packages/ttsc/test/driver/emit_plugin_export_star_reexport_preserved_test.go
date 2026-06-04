package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerExportStarReexportPreserved pins the emit
// contract for `export * from "./dep"`: when a plugin rewrites an unrelated
// sibling statement, the wildcard re-export must still lower to the CommonJS
// `__exportStar(require("./dep"), exports)` helper. A rebuilt SourceFile that
// drops or mis-parents the `ExportDeclaration` would silently lose the
// re-export, so we assert the helper call AND its require survive.
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
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
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
