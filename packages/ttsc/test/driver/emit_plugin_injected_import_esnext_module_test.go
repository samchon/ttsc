package driver_test

// EC-module-format-esnext: the commonjs injected-import case has an ESM mirror.
// Under module=esnext, a plugin-injected namespace import must stay an ESM
// `import * as <gen> from "..."` (NOT lowered to require), and the member
// reference built with the same unique identifier must print the same alias.
// This guards the ESM emit path of tsgo's module-transform for plugin-injected
// imports.

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

func TestEmitWithPluginTransformerInjectedImportEsnextModule(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "esnext", "target": "es2020", "outDir": "bin", "strict": true, "moduleResolution": "bundler" },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 2;\n")
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")

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
        ref := importName
        return ec.Factory.NewPropertyAccessExpression(ref, nil, ec.Factory.NewIdentifier("foo"), shimast.NodeFlagsNone)
      }
      if node.Kind == shimast.KindSourceFile {
        visited := visitor.VisitEachChild(node).AsSourceFile()
        stmts := append([]*shimast.Node{importDecl}, visited.Statements.Nodes...)
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
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v", emitted)
  }
  t.Logf("index.js:\n%s", js)

  // ESM, not CommonJS: no require lowering for the injected import.
  if strings.Contains(js, "require(") {
    t.Fatalf("esnext module must not lower the injected import to require:\n%s", js)
  }
  // The injected import stays an ESM namespace import and the reference uses
  // the same alias.
  bind := regexp.MustCompile(`import \* as (\w+) from "\./dep";`).FindStringSubmatch(js)
  if bind == nil {
    t.Fatalf("injected import did not stay an ESM namespace import:\n%s", js)
  }
  if !strings.Contains(js, "export const a = "+bind[1]+".foo;") {
    t.Fatalf("reference not aliased to the ESM import binding %q:\n%s", bind[1], js)
  }
}
