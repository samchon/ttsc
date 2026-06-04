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

// TestEmitWithPluginTransformerSetParentUnsetPreservesOriginalParents pins
// regression 6: SetParentInChildrenUnset must wire parents only on the
// synthetic nodes the plugin produced, leaving the parents of untouched parse
// nodes intact. The earlier bug ran SetParentInChildren over the whole
// rewritten tree, overwriting an `export namespace`'s original parents so the
// emit resolver lost its binder symbols and dropped the CommonJS namespace
// writeback (`exports.NS = NS = {}` plus the inner member assignment).
//
// This plugin rewrites ONLY one sibling statement's initializer and leaves the
// `export namespace` completely alone. If original parents are clobbered the
// namespace export lowering breaks; the assertions below catch that.
func TestEmitWithPluginTransformerSetParentUnsetPreservesOriginalParents(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    "export namespace Domain {",
    "  export const tag = \"d\";",
    "  export function wrap(value: string): string { return tag + value; }",
    "}",
    "export const seed: number = 0;",
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

  // Rewrite only the `0` initializer of `seed`; never visit into the namespace.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      // Do not descend into the untouched export namespace at all.
      if node.Kind == shimast.KindModuleDeclaration {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        return ec.Factory.NewNumericLiteral("42", 0)
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

  // The untouched export namespace must still lower its CommonJS writeback.
  if !strings.Contains(js, "exports.Domain = Domain = {}") {
    t.Fatalf("untouched export namespace lost its CommonJS writeback (original parents clobbered):\n%s", js)
  }
  // Its inner exported members must remain wired through the namespace object.
  if !strings.Contains(js, "Domain.tag =") {
    t.Fatalf("namespace member `tag` writeback was dropped:\n%s", js)
  }
  if !strings.Contains(js, "Domain.wrap =") {
    t.Fatalf("namespace member `wrap` writeback was dropped:\n%s", js)
  }
  // The sibling rewrite the plugin actually performed must have landed.
  if !strings.Contains(js, "exports.seed = 42;") {
    t.Fatalf("plugin sibling rewrite (0 -> 42) did not emit:\n%s", js)
  }
}
