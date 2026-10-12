package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerInjectedReferenceDoesNotReviveATypeOnlyImport Verifies an
// injected reference does not revive an existing import used only as a type.
//
// In this pipeline, the unlinked injected value reference does not keep the
// original type-position-only import alive. A plugin needs its own value import
// rather than relying on this reference to change original import elision.
// This test exercises the supported pipeline, not alternative builtin-chain
// input trees. It is adjacent enough to
// emit_plugin_ancestor_regeneration_preserves_export_resolution_test.go, where a
// REBUILT reference does keep its import, that assuming the two behave alike is
// the natural mistake.
//
//  1. `index.ts` imports the class `Foo` and uses it only in a type position.
//  2. A plugin appends a synthetic `Foo.bar();` statement, a value use that
//     exists only in the transformed tree.
//  3. Assert `./dep` is still elided and the injected statement was emitted, so
//     the limit is visible rather than hidden by a transform that never ran.
//
// @evidence contracts/testing.md#behavioral-verification Runs the actual source-appending transformer and requires emitted Foo.bar() while a pre-existing type-position-only ./dep import remains elided.
// @evidence contracts/testing.md#independent-expectations The stated plugin contract preserves only imports marked by original value use or independently synthesized imports; authored Foo.bar call and absent require establish that precise limitation.
// @evidence contracts/testing.md#distinguishing-cases A synthetic value reference does not revive an original type-only import; actual call presence prevents a no-op transform from passing.
// @evidence contracts/testing.md#execution-ownership The owning Go unit executes direct transformer/compiler APIs with captured output and Program cleanup. It certifies the documented emission limitation, not executable validity of a plugin that fails to synthesize its needed import.
func TestEmitWithPluginTransformerInjectedReferenceDoesNotReviveATypeOnlyImport(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export class Foo { static bar(): number { return 1; } }\n")
  writeProjectFile(t, root, "index.ts", "import { Foo } from \"./dep\";\nexport const a: Foo | null = null;\n")

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
      if node.Kind == shimast.KindSourceFile {
        visited := visitor.VisitEachChild(node).AsSourceFile()
        call := ec.Factory.NewCallExpression(
          ec.Factory.NewPropertyAccessExpression(
            ec.Factory.NewIdentifier("Foo"), nil,
            ec.Factory.NewIdentifier("bar"), shimast.NodeFlagsNone),
          nil, nil, ec.Factory.NewNodeList(nil), shimast.NodeFlagsNone)
        stmts := append([]*shimast.Node{}, visited.Statements.Nodes...)
        stmts = append(stmts, ec.Factory.NewExpressionStatement(call))
        return ec.Factory.UpdateSourceFile(visited, ec.Factory.NewNodeList(stmts), visited.EndOfFileToken)
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

  if !strings.Contains(js, "Foo.bar()") {
    t.Fatalf("plugin transform did not land, so the elision outcome proves nothing:\n%s", js)
  }
  if strings.Contains(js, `require("./dep")`) {
    t.Fatalf("an injected reference revived a type-only import; the documented contract is that a plugin synthesizes its own import:\n%s", js)
  }
}
