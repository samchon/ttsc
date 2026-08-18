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

// TestEmitWithPluginTransformerRebuiltNamespaceImportReferenceKeepsItsBinding
// covers the third and last binding shape an import clause can take.
//
// Elision tests the clause's bindings rather than the ImportDeclaration, so a
// named specifier, a default binding, and a namespace import arrive at the
// resolver as three different node kinds. The named and default shapes are
// pinned by siblings. This one also drags in the `__importStar` helper, which
// the emitted file needs and which disappears with the binding, so the failure
// is larger than one missing line.
//
//  1. `index.ts` binds `./dep` with `import * as ns` and reads `ns.foo`.
//  2. A plugin rebuilds that reference from a fresh ec.Factory identifier,
//     SetOriginal-linked back to the parse-tree one.
//  3. Assert the emitted file aliases the read and declares the binding that
//     alias names.
func TestEmitWithPluginTransformerRebuiltNamespaceImportReferenceKeepsItsBinding(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "import * as ns from \"./dep\";\nexport const a = ns.foo;\n")

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
      if node.Kind == shimast.KindIdentifier && node.Text() == "ns" &&
        node.Parent != nil && node.Parent.Kind == shimast.KindPropertyAccessExpression {
        syn := ec.Factory.NewIdentifier("ns")
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

  alias := regexp.MustCompile(`exports\.a = (\w+)\.foo;`).FindStringSubmatch(js)
  if alias == nil {
    t.Fatalf("rebuilt namespace-import reference was not aliased in the export writeback:\n%s", js)
  }
  if !strings.Contains(js, "const "+alias[1]+" = ") || !strings.Contains(js, `require("./dep")`) {
    t.Fatalf("reference aliased to %s but its namespace binding was elided, so the module throws ReferenceError:\n%s", alias[1], js)
  }
}
