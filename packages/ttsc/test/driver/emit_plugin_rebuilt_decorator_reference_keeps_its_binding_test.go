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

// TestEmitWithPluginTransformerRebuiltDecoratorReferenceKeepsItsBinding covers
// the dangling-alias crash on the shape ttsc's own plugin lane was built for.
//
// Rewriting a decorator call on a controller method is the canonical ttsc
// transform, named as the example in restoreOriginalDeclarationSymbols itself,
// and it is what a nestia-style host does. What it adds over the sibling
// rebuilt-reference tests is the legacy decorator lowering: the reference is
// moved out of the class body into a `__decorate` call emitted after the class,
// so the alias and the binding it needs end up in different statements. The
// broken form is correspondingly harder to spot by eye, `(0, dep_1.Route)()`
// sitting inside `__decorate` with nothing in the file defining `dep_1`.
//
// Marking still reaches `Route` through markIdentifierAliasReferenced, the same
// path as the siblings. markDecoratorAliasReferenced is not involved: the
// unspecified-hint branch returns before it unless emitDecoratorMetadata is on,
// and it marks only parameter and return type nodes, never the decorator
// callee.
//
//  1. `index.ts` imports `Route` and applies `@Route()` to a class method.
//  2. A plugin rebuilds the decorator's call expression, SetOriginal-linking a
//     fresh `Route` identifier to the parse-tree one.
//  3. Assert the decorator is aliased AND that the alias names a require
//     binding the emitted file actually declares.
func TestEmitWithPluginTransformerRebuiltDecoratorReferenceKeepsItsBinding(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true, "experimentalDecorators": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const Route = (): MethodDecorator => () => {};\n")
  writeProjectFile(t, root, "index.ts",
    "import { Route } from \"./dep\";\n"+
      "export class Controller {\n"+
      "  @Route()\n"+
      "  get(): number {\n"+
      "    return 1;\n"+
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

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindCallExpression {
        call := node.AsCallExpression()
        if call.Expression != nil && call.Expression.Kind == shimast.KindIdentifier &&
          call.Expression.Text() == "Route" {
          synRoute := ec.Factory.NewIdentifier("Route")
          ec.SetOriginal(synRoute, call.Expression)
          return ec.Factory.NewCallExpression(
            synRoute, nil, nil, ec.Factory.NewNodeList(nil), shimast.NodeFlagsNone)
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

  // The legacy decorator lowering emits the aliased callee through a comma
  // expression, `(0, dep_1.Route)()`, so match the alias itself rather than a
  // call shape.
  alias := regexp.MustCompile(`(\w+)\.Route\b`).FindStringSubmatch(js)
  if alias == nil {
    t.Fatalf("rebuilt decorator reference was not aliased to <ns>.Route:\n%s", js)
  }
  if !strings.Contains(js, "const "+alias[1]+" = require(\"./dep\")") {
    t.Fatalf("decorator aliased to %s but its require binding was elided, so the module throws ReferenceError:\n%s", alias[1], js)
  }
}
