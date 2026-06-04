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

// TestEmitWithPluginTransformerAsyncGeneratorHelpersEmitted verifies the emit
// contract that downlevel helper injection still runs when a plugin transform
// is in the pipeline. At a low target an `async function` cannot run natively,
// so tsgo lowers it through the `__awaiter` runtime helper. The plugin here
// rewrites an unrelated numeric literal inside the async body, proving the
// synthetic-node visitor and the builtin downlevel transform compose: the
// helper must still be injected and the rewrite must land inside the lowered
// body, neither suppressing the other.
//
// Note on generators: tsgo's es5 emit does not currently rewrite `function*`
// into a `__generator` state machine (it leaves the generator syntax native),
// so this test does not assert `__generator`; it pins the part of the
// async/generator downlevel contract that tsgo actually implements today
// (`__awaiter` injection) and that a plugin pass must not break.
func TestEmitWithPluginTransformerAsyncGeneratorHelpersEmitted(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es5", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    "export async function load(): Promise<number> {",
    "  const v = await Promise.resolve(0);",
    "  return v;",
    "}",
    "",
  }, "\n"))

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin rewrites the `0` literal to `42` inside the async body; its presence
  // must not stop the builtin async downleveling, and the rewrite must survive
  // the lowering.
  rewroteLiteral := false
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        rewroteLiteral = true
        return ec.Factory.NewNumericLiteral("42", 0)
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

  if !rewroteLiteral {
    t.Fatalf("plugin visitor never saw the numeric literal; transform did not run:\n%s", js)
  }
  // The plugin's rewrite must be reflected in the lowered output.
  if !strings.Contains(js, "42") {
    t.Fatalf("plugin rewrite (0 -> 42) missing from emit:\n%s", js)
  }
  // Downlevel helper for async must be injected at a low target.
  if !strings.Contains(js, "__awaiter") {
    t.Fatalf("async function was not downleveled: __awaiter helper missing:\n%s", js)
  }
  // The async body must actually be threaded through the helper (not left as a
  // top-level native `async function` declaration).
  if !strings.Contains(js, "__awaiter(this") {
    t.Fatalf("async body not routed through __awaiter helper:\n%s", js)
  }
  if strings.Contains(js, "async function load") {
    t.Fatalf("native `async function load` survived downleveling:\n%s", js)
  }
}
