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

// TestEmitWithPluginTransformerRebuiltReferenceKeepsItsEsmImport carries the
// dangling-reference case onto the ES module lane.
//
// The sibling rebuilt-reference tests all emit CommonJS, where the damage is a
// missing `require` binding beside an alias that still mentions it. Under
// `module: esnext` there is no alias and no binding: the module transformer
// leaves the source `import` statement in place, so losing its mark deletes the
// import declaration outright and the emitted file references a name it never
// imports. Same cause, different transformer, and a fix proved only on the
// CommonJS lane would not prove this one.
//
//  1. `index.ts` imports `foo` and uses it as the initializer of `a`.
//  2. A plugin rebuilds that reference from a fresh ec.Factory identifier,
//     SetOriginal-linked back to the parse-tree one.
//  3. Assert the emitted module still declares the import and still uses `foo`.
func TestEmitWithPluginTransformerRebuiltReferenceKeepsItsEsmImport(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "esnext", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "import { foo } from \"./dep\";\nexport const a = foo;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindIdentifier && node.Text() == "foo" &&
        node.Parent != nil && node.Parent.Kind == shimast.KindVariableDeclaration {
        syn := ec.Factory.NewIdentifier("foo")
        ec.SetOriginal(syn, node)
        return syn
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

  if !strings.Contains(js, "export const a = foo;") {
    t.Fatalf("rebuilt reference did not survive as `foo` on the ESM lane:\n%s", js)
  }
  if !strings.Contains(js, `import { foo } from "./dep";`) {
    t.Fatalf("import declaration for ./dep was elided while the emitted module still references foo, so the module fails to resolve at load:\n%s", js)
  }
}
