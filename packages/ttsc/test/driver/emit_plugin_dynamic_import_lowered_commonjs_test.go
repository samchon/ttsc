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

// TestEmitWithPluginTransformerDynamicImportLoweredCommonJS Verifies CommonJS emission lowers
// a dynamic import beside a transformed sibling value.
//
// CommonJS module transformation must still lower the untouched dynamic import
// to a Promise continuation containing the dependency require.
// The plugin only mutates the sibling `const flag = 0` initializer to `1`; it
// never touches the dynamic import.
//
// 1. Emit the dynamic-import fixture after rewriting the sibling flag to 1.
// 2. Require Promise/then/require lowering and the flag replacement while rejecting the retained dynamic import.
//
// @evidence contracts/testing.md#behavioral-verification Calls the actual plugin transformer and requires sibling exports.flag = 1 plus Promise/then/require lowering while rejecting retained import(./dep).
// @evidence contracts/testing.md#independent-expectations Literal replacement one and authored ./dep specify independent emitter expectations; generated text does not provide its own reference answer.
// @evidence contracts/testing.md#distinguishing-cases Sibling-only mutation tests coexistence of plugin visitor and CommonJS import lowering, with raw import retention as the negative output boundary.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit invokes in-process compiler/visitor APIs with a private Program and captured writes and deferred close; runtime resolution is not claimed.
func TestEmitWithPluginTransformerDynamicImportLoweredCommonJS(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const value = 42;\n")
  writeProjectFile(t, root, "index.ts", "export const flag: number = 0;\nexport const loader = () => import(\"./dep\");\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin rewrites ONLY the sibling numeric literal 0 -> 1, never the import.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        return ec.Factory.NewNumericLiteral("1", 0)
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

  // The sibling mutation must have landed (proves the plugin ran).
  if !strings.Contains(js, "exports.flag = 1;") {
    t.Fatalf("sibling rewrite 0->1 missing:\n%s", js)
  }
  // The dynamic import must be lowered to the commonjs Promise/require form.
  if !strings.Contains(js, "Promise.resolve()") || !strings.Contains(js, ".then(") {
    t.Fatalf("dynamic import not lowered to Promise.resolve().then(...):\n%s", js)
  }
  if !strings.Contains(js, `require("./dep")`) {
    t.Fatalf("dynamic import did not lower to require(\"./dep\"):\n%s", js)
  }
  // It must NOT remain a raw dynamic import() call under commonjs.
  if strings.Contains(js, `import("./dep")`) {
    t.Fatalf("dynamic import left un-lowered as import(\"./dep\"):\n%s", js)
  }
}
