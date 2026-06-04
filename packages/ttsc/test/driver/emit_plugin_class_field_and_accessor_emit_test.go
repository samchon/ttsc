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

// TestEmitWithPluginTransformerClassFieldAndAccessor proves the emit contract
// for class fields and get/set accessors: when a plugin transform shares the
// emit context, tsgo's builtin class transform still
//   - moves each field initializer into the constructor body, and
//   - preserves both the get and set accessor declarations on the class.
//
// The plugin rewrites the field initializer string `"plugin"` -> `"PLUGIN"` so we
// can prove the plugin visitor ran over the same class, while the field-into-ctor
// lowering and the accessors must remain intact. A regression that dropped
// original links or the accessor/field declarations would change this emit and
// fail here.
func TestEmitWithPluginTransformerClassFieldAndAccessor(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es5",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    `export class Box {`,
    `  public label: string = "plugin";`,
    `  private _value: number = 0;`,
    `  public get value(): number { return this._value; }`,
    `  public set value(v: number) { this._value = v; }`,
    `}`,
    ``,
  }, "\n"))
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin transform: rewrite the string field initializer "plugin" -> "PLUGIN".
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindStringLiteral && node.Text() == "plugin" {
        return ec.Factory.NewStringLiteral("PLUGIN", 0)
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

  // Plugin transform ran: the field initializer is rewritten.
  if !strings.Contains(js, `"PLUGIN"`) {
    t.Fatalf("plugin transform did not rewrite the field initializer (expected \"PLUGIN\"):\n%s", js)
  }
  // Both field initializers must have been moved into the constructor body and
  // no longer appear as bare class-member declarations.
  if !strings.Contains(js, `this.label = "PLUGIN"`) {
    t.Fatalf("string field initializer was not lowered into the constructor (expected `this.label = \"PLUGIN\"`):\n%s", js)
  }
  if !strings.Contains(js, "this._value = 0") {
    t.Fatalf("numeric field initializer was not lowered into the constructor (expected `this._value = 0`):\n%s", js)
  }
  // Both accessor declarations must survive on the class.
  if !strings.Contains(js, "get value()") {
    t.Fatalf("get accessor was dropped from emit (expected `get value()`):\n%s", js)
  }
  if !strings.Contains(js, "set value(v)") {
    t.Fatalf("set accessor was dropped from emit (expected `set value(v)`):\n%s", js)
  }
}
