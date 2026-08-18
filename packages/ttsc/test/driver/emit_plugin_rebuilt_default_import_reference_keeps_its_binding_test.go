package driver_test

import (
  "path/filepath"
  "regexp"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerRebuiltDefaultImportReferenceKeepsItsBinding
// covers the dangling-alias crash through a default import, where
// emit_plugin_ancestor_regeneration_preserves_export_resolution_test.go covers
// it through a named one.
//
// The two are not the same case to import elision. It does not test the
// ImportDeclaration; it tests the clause and its bindings separately, so a named
// specifier and a default binding reach the resolver as different node kinds. A
// fix proved only on the named shape would leave the default shape free to keep
// emitting an alias whose require binding was elided, which throws
// ReferenceError as soon as the module loads.
//
//  1. `index.ts` imports `dep` as a default binding and calls `dep.run()`.
//  2. A plugin rebuilds that call's callee expression from fresh ec.Factory
//     nodes, SetOriginal-linked back to the parse-tree identifier.
//  3. Assert the emitted call is aliased AND that the alias names a require
//     binding the emitted file actually declares.
func TestEmitWithPluginTransformerRebuiltDefaultImportReferenceKeepsItsBinding(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true, "esModuleInterop": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "const api = { run: (): number => 1 };\nexport default api;\n")
  writeProjectFile(t, root, "index.ts", "import dep from \"./dep\";\nexport const a = dep.run();\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rebuild `dep.run` into fresh nodes. The `dep` leaf is a new identifier
  // linked to the parse-tree one, which is what makes the reference resolvable
  // to the import at all; its mark, however, only exists on the parse tree.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindPropertyAccessExpression {
        access := node.AsPropertyAccessExpression()
        if access.Expression != nil && access.Expression.Kind == shimast.KindIdentifier &&
          access.Expression.Text() == "dep" {
          synDep := ec.Factory.NewIdentifier("dep")
          ec.SetOriginal(synDep, access.Expression)
          return ec.Factory.NewPropertyAccessExpression(
            synDep, nil, ec.Factory.NewIdentifier("run"), shimast.NodeFlagsNone)
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

  alias := regexp.MustCompile(`(\w+)\.default\.run\(\)`).FindStringSubmatch(js)
  if alias == nil {
    t.Fatalf("rebuilt default-import reference was not aliased to <ns>.default.run():\n%s", js)
  }
  // Tie the binding to the alias in one pattern rather than asserting the two
  // independently. esModuleInterop wraps the call in __importDefault, so the
  // middle is left open instead of matching that helper by name.
  if !regexp.MustCompile(`const ` + alias[1] + ` = [^\n]*require\("\./dep"\)`).MatchString(js) {
    t.Fatalf("reference aliased to %s but no require binding for ./dep was emitted under that name, so the module throws ReferenceError:\n%s", alias[1], js)
  }
}
