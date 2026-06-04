package driver_test
import (
  "path/filepath"; "strings"; "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)
// TestEmitWithPluginTransformerNamespace guards against a regression where a
// top-level `export namespace` was dropped from emit when the plugin rebuilt the
// SourceFile (sibling statements rewritten): SetParentInChildren overwrote the
// original namespace node's parent, so runtime-syntax mis-resolved it.
func TestEmitWithPluginTransformerNamespace(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export namespace Foo { export const bar = (k: string): string[] => [k]; }\nexport const x: number = 0;\n")
  prog, _, _ := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  defer prog.Close()
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var v *shimast.NodeVisitor
    visit := func(n *shimast.Node) *shimast.Node {
      if n != nil && n.Kind == shimast.KindNumericLiteral && n.Text() == "0" { return ec.Factory.NewNumericLiteral("1", 0) }
      return v.VisitEachChild(n)
    }
    v = ec.NewNodeVisitor(visit)
    return v.VisitSourceFile(sf)
  }
  emitted := map[string]string{}
  prog.EmitWithPluginTransformer(transform, func(fn, text string, _ *shimcompiler.WriteFileData) error { emitted[filepath.Base(fn)] = text; return nil })
  js := emitted["index.js"]
  if strings.Contains(js, "exports.Foo = Foo = {}") { t.Logf("OK namespace emitted") } else { t.Errorf("BROKEN namespace:\n%s", js) }
}
