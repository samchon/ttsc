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

// TestEmitWithPluginTransformerTypeOnlyImportElidedSyntheticSurvives pins both
// sides of the import-elision contract at once:
//
//   - A *parsed* import that is used only in type position is dropped by tsgo's
//     import elision (no `require("./types")` reaches the emitted JS), because the
//     checker proves it carries no runtime value.
//   - A *synthetic* namespace import the plugin injects via ec.Factory has no
//     parse node and no checker symbol, so elision cannot reason about it and it
//     survives as an unconditional `require("./dep")` — the same property
//     emit_plugin_test.go relies on, asserted here from the opposite direction
//     (a real type-only import next to it is what proves elision is actually
//     running and would have removed the synthetic one if it were elidable).
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
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
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
