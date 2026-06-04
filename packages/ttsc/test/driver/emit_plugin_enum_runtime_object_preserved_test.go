package driver_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerEnumRuntimeObjectPreserved guards the emit
// contract for a plain (non-const) TypeScript `enum` that lives next to a node
// the plugin rewrites. tsgo lowers a runtime enum into the canonical commonjs
// IIFE shape (`var E; (function (E) { ... })(E || (E = {}));`) that builds the
// enum's runtime object. The regression this pins: when the plugin rebuilds the
// SourceFile to mutate a *sibling* statement, the enum's own statements must
// keep their original parent links so tsgo's enum-transform still produces the
// IIFE and the enum object survives at runtime instead of collapsing to nothing.
//
// The synthetic plugin only touches the sibling `const x = 0` initializer (it
// becomes `1`); it never visits the enum. If parent threading were broken the
// enum would mis-lower and the assertions on the IIFE / member writebacks fail.
func TestEmitWithPluginTransformerEnumRuntimeObjectPreserved(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export enum Color { Red, Green, Blue }\nexport const x: number = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin rewrites ONLY the sibling numeric literal 0 -> 1, never the enum.
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
  if !strings.Contains(js, "exports.x = 1;") {
    t.Fatalf("sibling rewrite 0->1 missing:\n%s", js)
  }
  // The enum must lower to its runtime IIFE that constructs the enum object.
  // Shape: `var Color; (function (Color) { ... })(Color || (Color = {}));`
  iife := regexp.MustCompile(`\(function \((\w+)\) \{`).FindStringSubmatch(js)
  if iife == nil {
    t.Fatalf("enum runtime IIFE not emitted (enum collapsed):\n%s", js)
  }
  enumName := iife[1]
  if !strings.Contains(js, "var "+enumName+";") {
    t.Fatalf("enum `var %s;` declaration missing:\n%s", enumName, js)
  }
  // The IIFE is invoked with the enum object bootstrap. Because the enum is
  // exported, tsgo also threads the `exports.Color =` writeback into the
  // bootstrap argument: `(Color || (exports.Color = Color = {}))`. Both the
  // bootstrap and the export writeback must be present, the latter being the
  // very writeback whose loss is the namespace/export emit regression.
  bootstrap := regexp.MustCompile(`\}\)\(` + regexp.QuoteMeta(enumName) + ` \|\| \(([^)]*)` + regexp.QuoteMeta(enumName) + ` = \{\}\)\)`).FindStringSubmatch(js)
  if bootstrap == nil {
    t.Fatalf("enum object bootstrap `(%s || (... %s = {}))` missing:\n%s", enumName, enumName, js)
  }
  if !strings.Contains(js, "exports."+enumName+" =") {
    t.Fatalf("exported enum lost its `exports.%s =` writeback:\n%s", enumName, js)
  }
  // The enum members must write back into the runtime object so it is populated
  // rather than empty (e.g. `Color[Color["Red"] = 0] = "Red";`).
  if !strings.Contains(js, enumName+`["Red"]`) || !strings.Contains(js, enumName+`["Blue"]`) {
    t.Fatalf("enum member writebacks missing (runtime object would be empty):\n%s", js)
  }
}
