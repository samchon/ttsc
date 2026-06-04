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

// TestEmitWithPluginTransformerInjectedImport drives the official
// driver.EmitWithPluginTransformer end-to-end with typia's real pattern: the
// plugin INJECTS its own namespace import built with ec.Factory and references
// a member through NewGeneratedNameForNode. tsgo's builtin module-transform then
// emits the require unconditionally (a synthetic import has no parse node, so
// import-elision never drops it) and the generated name lines up between the
// import and the reference, all without any checker/symbol involvement and
// without text-splice or hand-rolled aliasing.
func TestEmitWithPluginTransformerInjectedImport(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin transformer: inject `import * as <gen> from "./dep"` and rewrite the
  // `0` initializer to `<gen>.foo`, using NewGeneratedNameForNode(modSpec) for
  // both so they print as the same name.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    modSpec := ec.Factory.NewStringLiteral("./dep", 0)
    nsImport := ec.Factory.NewNamespaceImport(ec.Factory.NewGeneratedNameForNode(modSpec))
    clause := ec.Factory.NewImportClause(shimast.KindUnknown, nil, nsImport)
    importDecl := ec.Factory.NewImportDeclaration(nil, clause, modSpec, nil)

    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        ref := ec.Factory.NewGeneratedNameForNode(modSpec)
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
  t.Logf("index.js:\n%s", js)
  // The namespace alias must be identical between the require binding
  // (`const X = ...require("./dep")`) and the member reference
  // (`exports.a = X.foo`) — tsgo's generated-name resolution lines them up.
  bind := regexp.MustCompile(`const (\w+) = [^\n]*require\("\./dep"\)`).FindStringSubmatch(js)
  if bind == nil {
    t.Fatalf("injected import did not emit a require binding:\n%s", js)
  }
  if !strings.Contains(js, "exports.a = "+bind[1]+".foo;") {
    t.Fatalf("reference %q.foo not aliased to the require binding %q:\n%s", bind[1], bind[1], js)
  }
}
