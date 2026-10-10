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

// TestEmitWithPluginTransformerAncestorRegenerationPreservesExportResolution Verifies
// rebuilding an exported declaration preserves the imported leaf's alias and export writeback.
//
// The alias and the binding it names are asserted together, which is the point
// rather than a belt-and-braces extra. An alias without its binding is
// exactly what this lane would emit if the builtin chain were built from
// the post-plugin tree: `exports.a = dep_1.foo + 41;` with no
// `const dep_1 = require("./dep");` anywhere in the file, which throws
// `ReferenceError: dep_1 is not defined` the moment the module loads. Matching only the alias would
// pass on that output.
//
// 1. Transform an imported leaf while rebuilding its ancestor with retained original identity.
// 2. Require the emitted require binding, matching alias use and exported assignment.
//
// @evidence contracts/testing.md#behavioral-verification Runs EmitWithPluginTransformer using an actual fresh ancestor and original-linked imported leaf; emitted text must have matching alias use, require binding and exported assignment.
// @evidence contracts/testing.md#independent-expectations Literal ./dep module, foo member and +41 expression independently specify semantic structure; extracted generated alias only correlates declaration and use rather than supplying expected behavior.
// @evidence contracts/testing.md#distinguishing-cases Rebuilt ancestor plus original-linked leaf distinguishes this route from a parse-tree leaf, and require/export checks reject dangling aliases or lost export binding.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit directly runs the actual transformer/compiler and captures its writes with private Program cleanup; this test inspects generated structure and does not execute the output.
func TestEmitWithPluginTransformerAncestorRegenerationPreservesExportResolution(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "import { foo } from \"./dep\";\nexport const a = foo;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      // Regenerate the ANCESTOR (the whole VariableDeclaration of `a`), not just
      // a leaf identifier. Rebuild its initializer into a fresh binary
      // expression `<syntheticFoo> + 41` and re-create the declaration node
      // around it via UpdateVariableDeclaration. The `foo` leaf is fresh-from-ec
      // and SetOriginal-linked back to the parse-tree initializer; the `+ 41`
      // expression has no original, while the emit context's update hook links
      // the regenerated declaration to its original declaration.
      if node.Kind == shimast.KindVariableDeclaration {
        decl := node.AsVariableDeclaration()
        if decl.Name() != nil && decl.Name().Kind == shimast.KindIdentifier && decl.Name().Text() == "a" {
          synFoo := ec.Factory.NewIdentifier("foo")
          ec.SetOriginal(synFoo, decl.Initializer)
          newInit := ec.Factory.NewBinaryExpression(
            nil,
            synFoo,
            nil,
            ec.Factory.NewToken(shimast.KindPlusToken),
            ec.Factory.NewNumericLiteral("41", 0),
          )
          return ec.Factory.UpdateVariableDeclaration(decl, decl.Name(), decl.ExclamationToken, decl.Type, newInit)
        }
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
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

  // tsgo's module-transform must have aliased the original-linked `foo` leaf to
  // the parse-tree import's namespace binding `dep_1.foo`, even though it sits
  // inside a brand-new ancestor expression. A broken original/parent wiring
  // would leave a bare `foo` here.
  alias := regexp.MustCompile(`(\w+)\.foo \+ 41`).FindStringSubmatch(js)
  if alias == nil {
    t.Fatalf("regenerated ancestor reference was not aliased to <ns>.foo (bare foo or missing):\n%s", js)
  }
  if strings.Contains(js, "= foo + 41") {
    t.Fatalf("reference printed as bare `foo`, import alias was lost:\n%s", js)
  }
  // The alias is worthless without the binding it names. Import elision decides
  // that binding from the linked references the checker marked, so this is the
  // assertion that fails when the builtin chain is built from the post-plugin
  // tree instead of the parse tree.
  if !strings.Contains(js, "const "+alias[1]+" = require(\"./dep\")") {
    t.Fatalf("reference aliased to %s but its require binding was elided, so the emitted module throws ReferenceError:\n%s", alias[1], js)
  }
  // The binder symbol of `a` must still resolve so the export writeback survives
  // on the regenerated ancestor.
  if !strings.Contains(js, "exports.a = "+alias[1]+".foo + 41;") {
    t.Fatalf("export writeback for `a` lost after ancestor regeneration:\n%s", js)
  }
}
