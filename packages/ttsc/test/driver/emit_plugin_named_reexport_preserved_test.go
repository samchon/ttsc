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

// TestEmitWithPluginTransformerNamedReexportPreserved is an emit-contract guard:
// a `export { x } from "./dep"` named re-export must survive a plugin transform
// and still lower to commonjs as an `Object.defineProperty(exports, "x", ...)`
// getter over the re-exported require binding. The plugin here rewrites an
// unrelated sibling statement (the `0` initializer) so the SourceFile is rebuilt
// around the re-export; a regression in parent/original wiring or in the
// re-export's binder resolution would drop the defineProperty getter, leaving
// `exports.x` undefined at runtime.
func TestEmitWithPluginTransformerNamedReexportPreserved(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const x: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "export { x } from \"./dep\";\nexport const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin rewrites only the unrelated `0` initializer to `1`, forcing the
  // SourceFile to be rebuilt while leaving the re-export statement untouched.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var v *shimast.NodeVisitor
    visit := func(n *shimast.Node) *shimast.Node {
      if n != nil && n.Kind == shimast.KindNumericLiteral && n.Text() == "0" {
        return ec.Factory.NewNumericLiteral("1", 0)
      }
      return v.VisitEachChild(n)
    }
    v = ec.NewNodeVisitor(visit)
    return v.VisitSourceFile(sf)
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

  // The named re-export must lower to a defineProperty getter keyed on "x".
  if !strings.Contains(js, `Object.defineProperty(exports, "x"`) {
    t.Fatalf("named re-export `x` did not survive as a defineProperty getter:\n%s", js)
  }
  // And the require for the re-exported module must be present.
  if !strings.Contains(js, `require("./dep")`) {
    t.Fatalf("re-export require(\"./dep\") missing:\n%s", js)
  }
  // The unrelated rewrite must have still applied (proves the plugin actually
  // rebuilt this file, so the re-export survived a real transform, not a no-op).
  if !strings.Contains(js, "exports.a = 1;") {
    t.Fatalf("sibling rewrite `0`->`1` did not apply, transform was a no-op:\n%s", js)
  }
}
