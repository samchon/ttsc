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

// TestEmitWithPluginTransformerInjectedImport Verifies an injected namespace import and
// generated reference share the emitted dependency binding.
//
// A synthetic namespace import has no parse original for import elision to discard. Its
// file-level unique name must stay shared by the require declaration and exported member
// reference; matching both structures detects an emitted alias with no usable binding.
//
// 1. Inject the namespace import and replace the fixture numeric initializer with its member access.
// 2. Require the dependency require and exported foo access through the same generated binding.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual namespace import injection and numeric replacement, requiring ./dep require declaration and exported foo access through that same generated binding.
// @evidence contracts/testing.md#independent-expectations Authored ./dep and foo specify required semantics; regex captures generated alias only to correlate its declaration and use.
// @evidence contracts/testing.md#distinguishing-cases An absent source import becomes an injected runtime import with shared unique name, distinguishing retained binding from dangling or mismatched use.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit uses the actual emit factory, visitor and compiler with a private Program and local write map and deferred close, without an installed plugin or compiled host.
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
  // `0` initializer to `<gen>.foo`, reusing one file-level unique identifier so
  // both positions print as the same name.
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
