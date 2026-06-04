package driver_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerAncestorRegenerationPreservesExportResolution is
// regression 7 widened beyond the leaf-identifier case. The existing prototype
// tests only swap a single `foo` identifier 1:1. Here the plugin regenerates the
// WHOLE ancestor (the VariableDeclaration of `a`): it rebuilds the initializer
// into a fresh binary expression `foo + 41` and re-creates the declaration node
// around it, where the `foo` leaf is a fresh ec.Factory identifier SetOriginal-
// linked back to the parse-tree initializer. Even though the parent expression
// and the declaration node are brand new (they never existed in the parse tree),
// the original threading on the leaf must still let tsgo's module-transform
// alias `foo` to the require binding, and the binder symbol of `a` must still
// resolve so the `exports.a =` writeback survives. A broken original/parent
// wiring would drop the alias (printing bare `foo + 41`) or drop the export
// assignment.
func TestEmitWithPluginTransformerAncestorRegenerationPreservesExportResolution(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
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
      // Regenerate the ANCESTOR (the whole VariableDeclaration of `a`), not just
      // a leaf identifier. Rebuild its initializer into a fresh binary
      // expression `<syntheticFoo> + 41` and re-create the declaration node
      // around it via UpdateVariableDeclaration. The `foo` leaf is fresh-from-ec
      // and SetOriginal-linked back to the parse-tree initializer; the `+ 41`
      // parent and the regenerated declaration are synthetic with no original.
      if node.Kind == shimast.KindVariableDeclaration {
        decl := node.AsVariableDeclaration()
        if decl.Name() != nil && decl.Name().Kind == shimast.KindIdentifier && decl.Name().Text() == "a" {
          synFoo := ec.Factory.NewIdentifier("foo")
          ec.SetOriginal(synFoo, decl.Initializer)
          newInit := ec.Factory.NewBinaryExpression(
            nil,
            synFoo,
            nil,
            ec.Factory.NewToken(shimast.KindPlusToken),
            ec.Factory.NewNumericLiteral("41", 0),
          )
          return ec.Factory.UpdateVariableDeclaration(decl, decl.Name(), decl.ExclamationToken, decl.Type, newInit)
        }
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

  // tsgo's module-transform must have aliased the original-linked `foo` leaf to
  // the parse-tree import's namespace binding `dep_1.foo`, even though it sits
  // inside a brand-new ancestor expression. A broken original/parent wiring
  // would leave a bare `foo` here.
  alias := regexp.MustCompile(`(\w+)\.foo \+ 41`).FindStringSubmatch(js)
  if alias == nil {
    t.Fatalf("regenerated ancestor reference was not aliased to <ns>.foo (bare foo or missing):\n%s", js)
  }
  if strings.Contains(js, "= foo + 41") {
    t.Fatalf("reference printed as bare `foo`, import alias was lost:\n%s", js)
  }
  // The binder symbol of `a` must still resolve so the export writeback survives
  // on the regenerated ancestor.
  if !strings.Contains(js, "exports.a = "+alias[1]+".foo + 41;") {
    t.Fatalf("export writeback for `a` lost after ancestor regeneration:\n%s", js)
  }
}
