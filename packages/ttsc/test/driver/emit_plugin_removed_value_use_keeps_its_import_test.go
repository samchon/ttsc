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

// TestEmitWithPluginTransformerRemovedValueUseKeepsItsImport pins the side of
// import elision that decides where linked references are marked.
//
// The builtin chain is built from the parse tree, so the checker sees the value
// use of `foo` that the source really contains, even after a transform replaced
// it. Marking the post-plugin tree instead would find no use left and let
// elision drop `require("./dep")`, silently discarding whatever side effects
// that module performs — a behavior change from `ts-patch` and TypeScript 5-6,
// which fixed the marks at check time on the parse tree.
//
//  1. `index.ts` imports `foo` and uses it as the initializer of `a`.
//  2. A plugin replaces that initializer with the literal 42, removing the only
//     value use.
//  3. Assert the emitted JavaScript still requires `./dep`, and that the
//     initializer really was rewritten.
func TestEmitWithPluginTransformerRemovedValueUseKeepsItsImport(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "import { foo } from \"./dep\";\nexport const a = foo;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindVariableDeclaration {
        decl := node.AsVariableDeclaration()
        if decl.Name() != nil && decl.Name().Kind == shimast.KindIdentifier && decl.Name().Text() == "a" {
          return ec.Factory.UpdateVariableDeclaration(decl, decl.Name(), decl.ExclamationToken, decl.Type,
            ec.Factory.NewNumericLiteral("42", 0))
        }
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

  if !strings.Contains(js, `require("./dep")`) {
    t.Fatalf("import of ./dep was elided after its last value use was transformed away:\n%s", js)
  }
  if !strings.Contains(js, "exports.a = 42;") {
    t.Fatalf("plugin transform did not land, so the elision outcome proves nothing:\n%s", js)
  }
}
