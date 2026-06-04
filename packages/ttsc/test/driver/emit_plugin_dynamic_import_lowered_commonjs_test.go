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

// TestEmitWithPluginTransformerDynamicImportLoweredCommonJS guards the emit
// contract for a dynamic `import("./dep")` expression that coexists with a
// plugin transform. Under the commonjs module target tsgo lowers a dynamic
// import to `Promise.resolve().then(() => require("./dep"))`. The regression
// this pins: when the plugin rebuilds the SourceFile (to rewrite a sibling
// statement) the dynamic-import call must still be recognized by tsgo's
// module-transform and lowered, not left as a raw `import(...)` call that would
// throw at runtime under commonjs.
//
// The plugin only mutates the sibling `const flag = 0` initializer to `1`; it
// never touches the dynamic import.
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
