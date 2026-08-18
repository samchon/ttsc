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

// TestEmitWithPluginTransformerInjectedReferenceDoesNotReviveATypeOnlyImport
// pins the limit of the plugin emit contract, so it stays a stated boundary
// rather than an accident of where references are marked.
//
// A plugin cannot keep a pre-existing import alive by referencing it from
// injected code: it must synthesize its own import, which elision preserves
// unconditionally because a synthetic import has no parse original. This holds
// no matter which tree the builtin chain is built from, so the case is a stated
// limit rather than a consequence of that choice — which is exactly why it needs
// a test. It is adjacent enough to
// emit_plugin_ancestor_regeneration_preserves_export_resolution_test.go, where a
// REBUILT reference does keep its import, that assuming the two behave alike is
// the natural mistake.
//
//  1. `index.ts` imports the class `Foo` and uses it only in a type position.
//  2. A plugin appends a synthetic `Foo.bar();` statement, a value use that
//     exists only in the transformed tree.
//  3. Assert `./dep` is still elided and the injected statement was emitted, so
//     the limit is visible rather than hidden by a transform that never ran.
func TestEmitWithPluginTransformerInjectedReferenceDoesNotReviveATypeOnlyImport(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export class Foo { static bar(): number { return 1; } }\n")
  writeProjectFile(t, root, "index.ts", "import { Foo } from \"./dep\";\nexport const a: Foo | null = null;\n")

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
      if node.Kind == shimast.KindSourceFile {
        visited := visitor.VisitEachChild(node).AsSourceFile()
        call := ec.Factory.NewCallExpression(
          ec.Factory.NewPropertyAccessExpression(
            ec.Factory.NewIdentifier("Foo"), nil,
            ec.Factory.NewIdentifier("bar"), shimast.NodeFlagsNone),
          nil, nil, ec.Factory.NewNodeList(nil), shimast.NodeFlagsNone)
        stmts := append([]*shimast.Node{}, visited.Statements.Nodes...)
        stmts = append(stmts, ec.Factory.NewExpressionStatement(call))
        return ec.Factory.UpdateSourceFile(visited, ec.Factory.NewNodeList(stmts), visited.EndOfFileToken)
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

  if !strings.Contains(js, "Foo.bar()") {
    t.Fatalf("plugin transform did not land, so the elision outcome proves nothing:\n%s", js)
  }
  if strings.Contains(js, `require("./dep")`) {
    t.Fatalf("an injected reference revived a type-only import; the documented contract is that a plugin synthesizes its own import:\n%s", js)
  }
}
