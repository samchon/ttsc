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

// TestEmitWithPluginTransformerRemovedValueUseKeepsItsImport Verifies replacing the original
// value use retains its dependency import in emitted output.
//
// The builtin chain is built from the parse tree, so the checker sees the value
// use of `foo` that the source really contains, even after a transform replaced
// it. This case requires the resulting `require("./dep")` instruction even
// though the transformed initializer no longer refers to that dependency; it
// does not execute dependency side effects or replace the marking pipeline to
// certify an alternative implementation. The companion case, a rebuilt
// reference left with an alias and no binding, is pinned by
// emit_plugin_ancestor_regeneration_preserves_export_resolution_test.go.
//
//  1. `index.ts` imports `foo` and uses it as the initializer of `a`.
//  2. A plugin replaces that initializer with the literal 42, removing the only
//     value use.
//  3. Assert the emitted JavaScript still requires `./dep`, and that the
//     initializer really was rewritten.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual value-use replacement and requires retained ./dep require plus exports.a = 42.
// @evidence contracts/testing.md#independent-expectations Authored original value import establishes the expected retained dependency-loading instruction under the declared parse-tree elision contract; independent literal replacement 42 proves transformation without executing side effects.
// @evidence contracts/testing.md#distinguishing-cases Removing the last original value use contrasts original-linked rebuilt references and injected-only type imports; replacement presence prevents plain output from passing.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit invokes real visitor/compiler APIs on its disposable Program and captures output with deferred close rather than launching a host.
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
