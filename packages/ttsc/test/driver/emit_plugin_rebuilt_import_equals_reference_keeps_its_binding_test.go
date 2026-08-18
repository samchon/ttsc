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

// TestEmitWithPluginTransformerRebuiltImportEqualsReferenceKeepsItsBinding
// covers the one alias declaration kind that is not part of an import clause.
//
// Elision reaches this node through shouldEmitImportEqualsDeclaration rather
// than the clause path the sibling tests take. That predicate is a disjunction,
// and inside an external module only its first arm can be true, so the outcome
// still comes down to IsReferencedAliasDeclaration on the ImportEqualsDeclaration
// itself: the second arm, IsTopLevelValueImportEqualsWithEntityName, returns
// false outright for an ExternalModuleReference. Of the three predicates elision
// consults, that first one is in fact the only mark-dependent one, which is why
// this shape belongs with the rebuilt-reference family even though it reaches it
// by a different route.
//
//  1. `index.ts` binds `./dep` with `import dep = require("./dep")` and reads
//     `dep.foo`.
//  2. A plugin rebuilds that reference from a fresh ec.Factory identifier,
//     SetOriginal-linked back to the parse-tree one.
//  3. Assert the emitted file still declares the require binding and still
//     reads `foo` through it.
func TestEmitWithPluginTransformerRebuiltImportEqualsReferenceKeepsItsBinding(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "import dep = require(\"./dep\");\nexport const a = dep.foo;\n")

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
      if node.Kind == shimast.KindIdentifier && node.Text() == "dep" &&
        node.Parent != nil && node.Parent.Kind == shimast.KindPropertyAccessExpression {
        syn := ec.Factory.NewIdentifier("dep")
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

  if !strings.Contains(js, "dep.foo") {
    t.Fatalf("rebuilt import-equals reference did not survive as dep.foo:\n%s", js)
  }
  if !strings.Contains(js, `require("./dep")`) {
    t.Fatalf("import-equals binding was elided while the emitted file still reads dep.foo, so the module throws ReferenceError:\n%s", js)
  }
}
