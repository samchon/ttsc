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

// TestEmitWithPluginTransformerTypeOnlySyntaxFullyErased Verifies rewriting a runtime sibling
// preserves erasure of the authored type-only names and syntax tokens.
//
// Changing the runtime initializer rebuilds the source file that also contains template
// literal, conditional and mapped types. The positive value replacement rules out empty
// output, while the independently listed type names and tokens detect accidental printing
// of the erased syntax.
//
// 1. Transform the runtime sibling initializer to 99 in the type-only syntax fixture.
// 2. Require the replacement and reject the independently listed type names and tokens.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual sibling numeric transformation and requires exports.runtime = 99 while rejecting the complete authored type-only name/token table.
// @evidence contracts/testing.md#independent-expectations Literal replacement 99 and independently listed type aliases/interface/constraint tokens specify required value output and erased type syntax.
// @evidence contracts/testing.md#distinguishing-cases Template literal, conditional/mapped types, interface and exported type alias coexist with a changed runtime value; positive control prevents empty-output negative success.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit executes actual compiler/visitor APIs with private Program and local writes and deferred close; generated text is inspected without a host executable.
func TestEmitWithPluginTransformerTypeOnlySyntaxFullyErased(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    "type Greeting<T extends string> = `hello ${T}`;",     // template literal type
    "type IsString<T> = T extends string ? true : false;", // conditional type
    "type Flags<T> = { [K in keyof T]: boolean };",        // mapped type
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

  // Require the rewritten exported value beside any generated module scaffolding.
  if !strings.Contains(js, "exports.runtime = 99;") {
    t.Fatalf("runtime sibling rewrite (0 -> 99) did not emit:\n%s", js)
  }

  // Tokens that exist ONLY inside the type-level syntax. None may survive.
  leaks := map[string]string{
    "Greeting":  "template-literal type alias name leaked",
    "IsString":  "conditional type alias name leaked",
    "Flags":     "mapped type alias name leaked",
    "Shape":     "interface name leaked",
    "Probe":     "exported type alias name leaked",
    "hello ${":  "template literal type body leaked",
    "extends":   "conditional/generic constraint syntax leaked",
    "keyof":     "mapped type `keyof` leaked",
    "interface": "interface declaration leaked",
    "readonly":  "interface readonly modifier leaked",
  }
  for token, msg := range leaks {
    if strings.Contains(js, token) {
      t.Fatalf("%s (found %q in emitted JS):\n%s", msg, token, js)
    }
  }
}
