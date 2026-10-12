package driver_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerMixedFactory Verifies independently constructed call nodes use
// the emit-context namespace binding in generated output.
//
// The call and member nodes come from an independent NodeFactory, while the unique
// namespace-import name belongs to the emit context. Checking the require binding and its
// foo(123) use together tests this mixed ownership without claiming every
// independent-factory tree is compatible.
//
// 1. Build the injected import and replacement call through the fixture mixed factories.
// 2. Require the dependency binding and the exported call through that binding with argument 123.
//
// @evidence contracts/testing.md#behavioral-verification Runs the actual mixed-factory transformer and requires a ./dep require binding plus exports.a call of that binding's foo with literal 123.
// @evidence contracts/testing.md#independent-expectations Authored ./dep, foo and 123 independently specify import/call semantics; the captured generated binding only correlates its use.
// @evidence contracts/testing.md#distinguishing-cases Standalone call/member nodes with emit-context unique import identity distinguish mixed factory use from all-emit-context creation.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit uses an actual independent NodeFactory, emit-context factory and compiler, capturing writes and closing its Program without building a plugin host.
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
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
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
