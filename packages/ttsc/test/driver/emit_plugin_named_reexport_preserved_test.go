package driver_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerNamedReexportPreserved Verifies a named re-export retains its
// CommonJS getter and dependency binding beside a rewritten sibling.
//
// A CommonJS named re-export needs both the defineProperty getter and the dependency
// binding it reads. The numeric sibling change makes ancestor regeneration observable;
// either missing structure would leave the authored re-export incomplete.
//
// 1. Transform the named-reexport fixture sibling initializer from 0 to 1.
// 2. Require the x getter and dependency require alongside the changed sibling assignment.
//
// @evidence contracts/testing.md#behavioral-verification Runs the actual numeric sibling transformer and requires the named export getter returning x from the ./dep require binding, plus changed exports.a assignment.
// @evidence contracts/testing.md#independent-expectations Literal x export, ./dep target and sibling replacement one independently establish generated structures.
// @evidence contracts/testing.md#distinguishing-cases Named re-export and unrelated real rewrite coexist, rejecting dropped module lowering or a no-op transformer.
// @evidence contracts/testing.md#execution-ownership The owning Go unit runs direct transformer/compiler APIs on a disposable Program and closes it after captured output; runtime getter behavior is not claimed.
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
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
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
  binding := regexp.MustCompile(`(?:const|let|var) (\w+) = require\("\./dep"\);`).FindStringSubmatch(js)
  if binding == nil {
    t.Fatalf("named re-export dependency binding missing:\n%s", js)
  }
  getter := `Object.defineProperty(exports, "x", { enumerable: true, get: function () { return ` + binding[1] + `.x; } });`
  if !strings.Contains(js, getter) {
    t.Fatalf("named re-export getter does not return its dependency's x:\n%s", js)
  }
  // The unrelated rewrite must have still applied (proves the plugin actually
  // rebuilt this file, so the re-export survived a real transform, not a no-op).
  if !strings.Contains(js, "exports.a = 1;") {
    t.Fatalf("sibling rewrite `0`->`1` did not apply, transform was a no-op:\n%s", js)
  }
}
