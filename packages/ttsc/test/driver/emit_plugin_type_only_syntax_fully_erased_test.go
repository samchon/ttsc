package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerTypeOnlySyntaxFullyErased pins the emit contract
// that type-only syntax (template literal types, conditional types, mapped
// types, plus the type aliases / interfaces holding them) is fully type-erased
// and never leaks into the JS output, even after the plugin rebuilds the
// SourceFile by rewriting a runtime sibling. A mis-wired tree could re-emit a
// type node as a value expression; the assertions below catch any such leak by
// scanning for tokens that only appear in the type-level syntax.
func TestEmitWithPluginTransformerTypeOnlySyntaxFullyErased(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    "type Greeting<T extends string> = `hello ${T}`;",                       // template literal type
    "type IsString<T> = T extends string ? true : false;",                   // conditional type
    "type Flags<T> = { [K in keyof T]: boolean };",                          // mapped type
    "interface Shape { readonly id: number; readonly label: Greeting<\"x\">; }",
    "export type Probe = IsString<Flags<Shape>>;",
    "export const runtime: number = 0;",
    "",
  }, "\n"))
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rewrite only the runtime `0`; all the type syntax must stay erased.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        return ec.Factory.NewNumericLiteral("99", 0)
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

  // The only runtime statement should be the rewritten const; nothing else.
  if !strings.Contains(js, "exports.runtime = 99;") {
    t.Fatalf("runtime sibling rewrite (0 -> 99) did not emit:\n%s", js)
  }

  // Tokens that exist ONLY inside the type-level syntax. None may survive.
  leaks := map[string]string{
    "Greeting":        "template-literal type alias name leaked",
    "IsString":        "conditional type alias name leaked",
    "Flags":           "mapped type alias name leaked",
    "Shape":           "interface name leaked",
    "Probe":           "exported type alias name leaked",
    "hello ${":        "template literal type body leaked",
    "extends":         "conditional/generic constraint syntax leaked",
    "keyof":           "mapped type `keyof` leaked",
    "interface":       "interface declaration leaked",
    "readonly":        "interface readonly modifier leaked",
  }
  for token, msg := range leaks {
    if strings.Contains(js, token) {
      t.Fatalf("%s (found %q in emitted JS):\n%s", msg, token, js)
    }
  }
}
