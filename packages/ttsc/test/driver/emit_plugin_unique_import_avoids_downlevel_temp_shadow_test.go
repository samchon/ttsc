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

// TestEmitPluginUniqueImportAvoidsDownlevelTempShadow verifies emit plugins:
// unique import bindings survive ES2015 downlevel temps.
//
// Locks the generated-name collision between a synthetic namespace import and
// the function-scoped variables that lower optional chaining and nullish
// coalescing. Both name families may be referenced inside the same function,
// so the import binding must use tsgo's unique-name channel.
//
// 1. Inject a namespace import and reference it inside a nullish expression.
// 2. Emit the source at ES2015 so tsgo allocates a function-scoped temp.
// 3. Assert the downlevel temp does not shadow the injected import binding.
func TestEmitPluginUniqueImportAvoidsDownlevelTempShadow(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2015", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 42;\n")
  writeProjectFile(t, root, "index.ts", "export const value = (input?: { nested?: number }): number => input?.nested ?? 0;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    modSpec := ec.Factory.NewStringLiteral("./dep", 0)
    importName := ec.Factory.NewUniqueNameEx("dep", shimprinter.AutoGenerateOptions{
      Flags: shimprinter.GeneratedIdentifierFlagsOptimistic | shimprinter.GeneratedIdentifierFlagsFileLevel,
    })
    nsImport := ec.Factory.NewNamespaceImport(importName)
    clause := ec.Factory.NewImportClause(shimast.KindUnknown, nil, nsImport)
    importDecl := ec.Factory.NewImportDeclaration(nil, clause, modSpec, nil)

    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        return ec.Factory.NewPropertyAccessExpression(importName, nil, ec.Factory.NewIdentifier("foo"), shimast.NodeFlagsNone)
      }
      if node.Kind == shimast.KindSourceFile {
        visited := visitor.VisitEachChild(node).AsSourceFile()
        statements := append([]*shimast.Node{importDecl}, visited.Statements.Nodes...)
        return ec.Factory.UpdateSourceFile(visited, ec.Factory.NewNodeList(statements), visited.EndOfFileToken)
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
  binding := regexp.MustCompile(`const (\w+) = [^\n]*require\("\./dep"\)`).FindStringSubmatch(js)
  if binding == nil {
    t.Fatalf("injected import did not emit a require binding:\n%s", js)
  }
  if !strings.Contains(js, binding[1]+".foo") {
    t.Fatalf("injected reference does not use import binding %q:\n%s", binding[1], js)
  }
  downlevelTemp := regexp.MustCompile(`const value = \(input\) => \{ var (\w+);`).FindStringSubmatch(js)
  if downlevelTemp == nil {
    t.Fatalf("ES2015 emit did not allocate the expected function-scoped temp:\n%s", js)
  }
  if downlevelTemp[1] == binding[1] {
    t.Fatalf("downlevel temp shadows injected import %q:\n%s", binding[1], js)
  }
}
