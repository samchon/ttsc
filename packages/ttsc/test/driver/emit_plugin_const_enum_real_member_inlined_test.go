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

// TestEmitWithPluginTransformerConstEnumRealMemberInlined is the emit-contract
// guard for const-enum inlining under a plugin transform. A REAL `const enum`
// member access (`Color.Green`, not a synthetic one) must still be inlined to
// its constant value by tsgo's emit even though the plugin ran a visitor over
// the SourceFile first. The const-enum inliner asks the emit resolver for the
// member's constant value; if the plugin's reconstruction of ancestor nodes
// detached the access from the binder symbol, GetConstantValue would return nil
// and the member access would leak into output as `Color.Green` (a reference to
// an enum object that const enums never materialize -> runtime ReferenceError).
func TestEmitWithPluginTransformerConstEnumRealMemberInlined(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  // Color.Green must inline to 1; Color.Red to 0. We keep an unrelated `0`
  // literal that the plugin rewrites, forcing the visitor to walk (and rebuild
  // ancestors of) the whole file, including the statement holding `Color.Green`.
  writeProjectFile(t, root, "index.ts",
    "const enum Color { Red = 0, Green = 1, Blue = 2 }\n"+
      "export const picked: Color = Color.Green;\n"+
      "export const flag: number = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Rewrite the unrelated `0` (the `flag` initializer) to `99`; leave the const
  // enum access alone so emit's inliner is the thing under test.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        // Only the `flag` initializer is a bare `0` at statement-init position;
        // the enum's `Red = 0` member initializer is also `0`, but rewriting it
        // is harmless to the Color.Green assertion (Green = 1 regardless).
        return ec.Factory.NewNumericLiteral("99", 0)
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

  // The const-enum member access must be inlined to its constant value. tsgo
  // emits the literal with a trailing `/* Color.Green */` provenance comment, so
  // the assertion is the inlined assignment, not the absence of the comment.
  if !strings.Contains(js, "exports.picked = 1") {
    t.Fatalf("const enum `Color.Green` did not inline to `1`:\n%s", js)
  }
  // A live member access (`= Color.Green;` with no preceding inlined literal)
  // would mean the inliner failed. After the literal `1`, only the provenance
  // comment may mention the name; assert no live `= Color.Green` assignment.
  if strings.Contains(js, "= Color.Green;") {
    t.Fatalf("const enum access leaked as a live reference `= Color.Green;`:\n%s", js)
  }
  // const enums emit no runtime object at all.
  if strings.Contains(js, "var Color") || strings.Contains(js, "Color = {}") {
    t.Fatalf("const enum unexpectedly materialized a runtime object:\n%s", js)
  }
}
