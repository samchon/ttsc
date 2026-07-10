package driver_test

// EC-importstar-helper-injection: under esModuleInterop, a source that already
// mixes a default import and a namespace import must emit BOTH the
// __importDefault and __importStar helpers, and a plugin-injected namespace
// import must be aliased by tsgo's module-transform without colliding with the
// source imports.
//
// The injected import is a namespace import, so it lowers through __importStar
// too; the assertion is that all three imports (source default, source
// namespace, injected namespace) get distinct require bindings and that the
// injected reference lines up with its own generated binding.

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

func TestEmitWithPluginTransformerImportStarHelperWithInjectedImport(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true, "esModuleInterop": true },
  "files": ["dft.ts", "star.ts", "dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dft.ts", "declare const x: { m(): number };\nexport default x;\n")
  writeProjectFile(t, root, "star.ts", "export const s: number = 1;\n")
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 2;\n")
  // The source already mixes a default import and a namespace import.
  writeProjectFile(t, root, "index.ts", "import D from \"./dft\";\nimport * as S from \"./star\";\nexport const a = 0;\nexport const b = D.m();\nexport const c = S.s;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin injects `import * as <gen> from "./dep"` and rewrites the `0`
  // initializer to `<gen>.foo`.
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

  // Both interop helpers must be injected.
  if !strings.Contains(js, "var __importStar =") {
    t.Fatalf("__importStar helper not injected:\n%s", js)
  }
  if !strings.Contains(js, "var __importDefault =") {
    t.Fatalf("__importDefault helper not injected:\n%s", js)
  }

  // The source default import lowers through __importDefault, the source
  // namespace import and the plugin-injected namespace import each lower
  // through __importStar; all three get distinct require bindings.
  defBind := regexp.MustCompile(`const (\w+) = __importDefault\(require\("\./dft"\)\);`).FindStringSubmatch(js)
  if defBind == nil {
    t.Fatalf("source default import not aliased via __importDefault:\n%s", js)
  }
  srcStarBind := regexp.MustCompile(`const (\w+) = __importStar\(require\("\./star"\)\);`).FindStringSubmatch(js)
  if srcStarBind == nil {
    t.Fatalf("source namespace import not aliased via __importStar:\n%s", js)
  }
  injBind := regexp.MustCompile(`const (\w+) = __importStar\(require\("\./dep"\)\);`).FindStringSubmatch(js)
  if injBind == nil {
    t.Fatalf("injected namespace import not aliased via __importStar:\n%s", js)
  }

  // No alias collision: the three bindings are pairwise distinct.
  if defBind[1] == srcStarBind[1] || defBind[1] == injBind[1] || srcStarBind[1] == injBind[1] {
    t.Fatalf("import alias collision: dft=%q star=%q dep=%q\n%s", defBind[1], srcStarBind[1], injBind[1], js)
  }

  // References line up with their own bindings.
  if !strings.Contains(js, "exports.b = "+defBind[1]+".default.m();") {
    t.Fatalf("default reference not aliased to %q:\n%s", defBind[1], js)
  }
  if !strings.Contains(js, "exports.c = "+srcStarBind[1]+".s;") {
    t.Fatalf("source namespace reference not aliased to %q:\n%s", srcStarBind[1], js)
  }
  if !strings.Contains(js, "exports.a = "+injBind[1]+".foo;") {
    t.Fatalf("injected reference not aliased to %q:\n%s", injBind[1], js)
  }
}
