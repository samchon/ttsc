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

// TestEmitWithPluginTransformerNestedNamespaceWriteback is the multi-level
// version of the namespace-writeback regression: a nested `export namespace
// Foo { export namespace Bar { ... } }`. When the plugin rebuilds a node buried
// in the inner namespace, BOTH the outer (`exports.Foo = Foo = {}`) and the
// inner (`Foo.Bar = Bar = {}`) writebacks, plus the deepest export member, must
// survive. A single missed parent-restore anywhere along the chain drops a
// writeback and leaves a namespace level `undefined` at runtime.
func TestEmitWithPluginTransformerNestedNamespaceWriteback(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts",
    "export namespace Foo {\n"+
      "  export namespace Bar {\n"+
      "    export const value: number = 0;\n"+
      "  }\n"+
      "}\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rebuild the deepest initializer `0` -> `0 + 5` so the visitor must
  // reconstruct both namespace bodies on the way up.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        left := ec.Factory.NewNumericLiteral("0", 0)
        right := ec.Factory.NewNumericLiteral("5", 0)
        return ec.Factory.NewBinaryExpression(nil, left, nil, ec.Factory.NewToken(shimast.KindPlusToken), right)
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
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v", emitted)
  }
  t.Logf("index.js:\n%s", js)

  // Outer namespace writeback.
  if !strings.Contains(js, "exports.Foo = Foo = {}") {
    t.Fatalf("outer namespace writeback `exports.Foo = Foo = {}` dropped:\n%s", js)
  }
  // Inner namespace writeback (nested namespaces write back onto their parent
  // object via `Bar = Foo.Bar || (Foo.Bar = {})`).
  if !strings.Contains(js, "Foo.Bar = {}") {
    t.Fatalf("inner namespace writeback `Foo.Bar = {}` dropped:\n%s", js)
  }
  // Deepest export member survives.
  if !strings.Contains(js, "Bar.value") {
    t.Fatalf("deepest export member `Bar.value` dropped:\n%s", js)
  }
  // The rebuilt initializer actually applied.
  if !strings.Contains(js, "0 + 5") {
    t.Fatalf("rebuilt initializer `0 + 5` not present, rewrite did not apply:\n%s", js)
  }
}
