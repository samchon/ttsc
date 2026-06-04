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

// TestEmitWithPluginTransformerNamespaceInnerCallRewrite extends the namespace
// writeback regression (R1) past the sibling-numeric-literal case: here the
// plugin REBUILDS a CallExpression that lives INSIDE the `export namespace`
// using the emit ec.Factory (callee + a fresh argument), rather than swapping a
// stray literal next to the namespace. The risk is the same root cause -- when
// the plugin's visitor reconstructs ancestor nodes (the namespace body, the
// export const, the call) the synthetic-parent wiring must keep the original
// parse nodes' parents intact so tsgo's commonjs lowering still emits both the
// `exports.Foo = Foo = {}` writeback AND the inner `Foo.compute = ...` member
// export. If parents were clobbered, the namespace IIFE writeback is dropped and
// `Foo` is `undefined` at runtime.
func TestEmitWithPluginTransformerNamespaceInnerCallRewrite(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  // seed(7) is the call we will rebuild; compute is the exported member that must
  // survive as `Foo.compute`.
  writeProjectFile(t, root, "index.ts",
    "function seed(n: number): number { return n; }\n"+
      "export namespace Foo {\n"+
      "  export const compute = (): number => seed(7);\n"+
      "}\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rewrite `seed(7)` into a freshly built `seed(7 + 35)` CallExpression using
  // the emit factory. This forces the visitor to reconstruct the call (and thus
  // its namespace ancestors) instead of merely substituting a leaf literal.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindCallExpression {
        call := node.AsCallExpression()
        if call.Expression != nil && call.Expression.Kind == shimast.KindIdentifier && call.Expression.Text() == "seed" {
          callee := ec.Factory.NewIdentifier("seed")
          left := ec.Factory.NewNumericLiteral("7", 0)
          right := ec.Factory.NewNumericLiteral("35", 0)
          plus := ec.Factory.NewBinaryExpression(nil, left, nil, ec.Factory.NewToken(shimast.KindPlusToken), right)
          arg := ec.Factory.NewNodeList([]*shimast.Node{plus})
          return ec.Factory.NewCallExpression(callee, nil, nil, arg, shimast.NodeFlagsNone)
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
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v", emitted)
  }
  t.Logf("index.js:\n%s", js)

  // 1) The namespace writeback must survive: `exports.Foo = Foo = {}` (or the
  //    `exports.Foo = Foo` writeback inside the IIFE) keeps Foo defined.
  if !strings.Contains(js, "exports.Foo = Foo = {}") {
    t.Fatalf("namespace writeback `exports.Foo = Foo = {}` was dropped:\n%s", js)
  }
  // 2) The inner export member must still be wired onto the namespace object.
  if !strings.Contains(js, "Foo.compute") {
    t.Fatalf("inner export member `Foo.compute` was dropped:\n%s", js)
  }
  // 3) The call must actually have been rebuilt (proves the visitor reconstructed
  //    namespace ancestors, not just left the original text).
  if !strings.Contains(js, "seed(7 + 35)") {
    t.Fatalf("rebuilt call `seed(7 + 35)` not present, rewrite did not apply:\n%s", js)
  }
}
