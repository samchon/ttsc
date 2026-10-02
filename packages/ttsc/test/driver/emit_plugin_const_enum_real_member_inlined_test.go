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

// TestEmitWithPluginTransformerConstEnumRealMemberInlined Verifies a genuine const-enum member
// remains inlined beside a transformed runtime value.
//
// The enum inliner consults the emit resolver for genuine parse-tree member accesses. The
// changed flag confirms the plugin ran, while literal Green = 1 and the absence of a
// runtime enum object distinguish preserved inlining from a leaked member reference.
//
// 1. Emit the const-enum fixture after rewriting its sibling control literal to 99.
// 2. Require the control replacement and Green value 1 while rejecting a live member assignment or enum object.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual plugin-transform emission and requires rewritten control flag 99, const enum member assignment to 1 and no live Color.Green assignment or runtime enum object.
// @evidence contracts/testing.md#independent-expectations Explicit Green = 1 and unrelated flag replacement 99 are authored independent values; absent live enum references follows const enum erasure.
// @evidence contracts/testing.md#distinguishing-cases Plugin rewrite control prevents a passing plain emitter; member inlining contrasts retained provenance comments with forbidden live references and objects.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit invokes its actual synthetic visitor/compiler and captures output with Program cleanup; no child host or JavaScript evaluation is required for these emitted-structure assertions.
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

  if !strings.Contains(js, "exports.flag = 99") {
    t.Fatalf("the plugin transform did not rewrite the control flag:\n%s", js)
  }

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
