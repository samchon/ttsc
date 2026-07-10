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

// TestEmitWithPluginTransformerMixedFactory proves the property that bounds the
// typia port: a plugin may build its big expression tree with its OWN global
// NodeFactory (typia keeps dozens of module-level factories) and only build the
// runtime-import name with the emit ec.Factory.NewUniqueNameEx. The non-import
// nodes are not import references, so tsgo's module-transform never touches
// them; only the generated namespace name needs the emit context. The require
// is still emitted and the alias still lines up, so the port can leave every
// typia programmer's factory alone and only rewire ImportProgrammer.
func TestEmitWithPluginTransformerMixedFactory(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo = (x: number): number => x;\n")
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  defer prog.Close()

  // typia 글로벌 factory 대역 (ec와 무관한 독립 factory)
  indep := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})

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
        // 검증 트리: 바깥 노드는 indep, namespace 참조만 ec.Factory
        ref := importName                                                                                        // <-- emit ec
        access := indep.NewPropertyAccessExpression(ref, nil, indep.NewIdentifier("foo"), shimast.NodeFlagsNone) // <-- indep
        arg := indep.NewNumericLiteral("123", 0)                                                                 // <-- indep
        return indep.NewCallExpression(access, nil, nil, indep.NewNodeList([]*shimast.Node{arg}), shimast.NodeFlagsNone)
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
  t.Logf("index.js:\n%s", js)
  bind := regexp.MustCompile(`const (\w+) = [^\n]*require\("\./dep"\)`).FindStringSubmatch(js)
  if bind == nil {
    t.Fatalf("no require binding:\n%s", js)
  }
  if !strings.Contains(js, "exports.a = "+bind[1]+".foo(123);") {
    t.Fatalf("mixed-factory ref not aliased to %q:\n%s", bind[1], js)
  }
}
