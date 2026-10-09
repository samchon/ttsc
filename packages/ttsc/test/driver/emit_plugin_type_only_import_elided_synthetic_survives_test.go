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

// TestEmitWithPluginTransformerTypeOnlyImportElidedSyntheticSurvives Verifies type-only
// imports disappear while an injected namespace import and matching runtime reference survive.
//
// The original Shape import is used only in a type annotation and must disappear from
// runtime output. The injected namespace import has no parse original and must survive
// with its matching foo use. Their coexistence distinguishes working import elision from
// either disabling elision or dropping every import.
//
// 1. Inject a runtime namespace import beside the fixture type-only import.
// 2. Require the type-only module and symbol to disappear while the injected require and matching foo use remain.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual namespace import injection and requires original types import/symbol erased while injected dep require and matching foo use survive.
// @evidence contracts/testing.md#independent-expectations Authored ./types/Shape type-only use contrasts explicitly injected ./dep/foo runtime use; generated alias captures only correlate binding and use.
// @evidence contracts/testing.md#distinguishing-cases Original type import and synthetic value import coexist, distinguishing functioning elision from overbroad dropping or disabled elision.
// @evidence contracts/testing.md#execution-ownership The owning Go unit runs actual compiler/visitor APIs on private Program input and captures output with deferred close; no runtime loader or installed plugin.
func TestEmitWithPluginTransformerTypeOnlyImportElidedSyntheticSurvives(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["types.ts", "dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "types.ts", "export interface Shape { kind: string; }\n")
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  // index.ts imports Shape purely for a type annotation -> must be elided.
  writeProjectFile(t, root, "index.ts", "import { Shape } from \"./types\";\nexport const a: Shape = { kind: \"x\" };\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Inject `import * as <gen> from "./dep"` (synthetic, must survive) and append
  // a runtime reference `<gen>.foo` as a fresh statement so the binding is also
  // used. The type-only `./types` import is left untouched to be elided.
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
      if node.Kind == shimast.KindSourceFile {
        visited := visitor.VisitEachChild(node).AsSourceFile()
        ref := importName
        access := ec.Factory.NewPropertyAccessExpression(ref, nil, ec.Factory.NewIdentifier("foo"), shimast.NodeFlagsNone)
        useStmt := ec.Factory.NewExpressionStatement(access)
        stmts := append([]*shimast.Node{importDecl}, visited.Statements.Nodes...)
        stmts = append(stmts, useStmt)
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

  // Type-only import elided: no runtime require of ./types.
  if strings.Contains(js, `require("./types")`) {
    t.Fatalf("type-only import ./types should have been elided but emitted a require:\n%s", js)
  }
  if strings.Contains(js, "Shape") {
    t.Fatalf("type-only symbol Shape leaked into runtime emit:\n%s", js)
  }

  // Synthetic import survived: ./dep require is present and its binding name is
  // the same as the member reference.
  bind := regexp.MustCompile(`const (\w+) = [^\n]*require\("\./dep"\)`).FindStringSubmatch(js)
  if bind == nil {
    t.Fatalf("synthetic import ./dep was wrongly elided (no require binding):\n%s", js)
  }
  if !strings.Contains(js, bind[1]+".foo") {
    t.Fatalf("synthetic reference not aliased to require binding %q:\n%s", bind[1], js)
  }
}
