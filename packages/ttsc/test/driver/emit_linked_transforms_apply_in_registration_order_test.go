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

// numericRewritePlugin is a synthetic EmitTransformPlugin whose emit-phase
// transform rewrites every numeric literal equal to `from` into `to`. Two of
// these are chained to prove ordering: stage A rewrites 0->100, stage B rewrites
// 100->200, so the chained result is 200 only if A runs before B.
type numericRewritePlugin struct {
  from string
  to   string
}

func (p *numericRewritePlugin) EmitTransform(_ driver.PluginContext) (driver.PluginTransform, error) {
  from, to := p.from, p.to
  return func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var v *shimast.NodeVisitor
    visit := func(n *shimast.Node) *shimast.Node {
      if n != nil && n.Kind == shimast.KindNumericLiteral && n.Text() == from {
        return ec.Factory.NewNumericLiteral(to, 0)
      }
      return v.VisitEachChild(n)
    }
    v = ec.NewNodeVisitor(visit)
    return v.VisitSourceFile(sf)
  }, nil
}

// TestEmitLinkedTransformsApplyInRegistrationOrder is an emit-contract guard for
// EmitLinkedTransforms: when several EmitTransformPlugins are registered, their
// PluginTransforms must be chained in registration order, each one fed the
// previous one's output. Two stages are registered: A (0->100) then B (100->200).
// Only the A-then-B order produces `exports.a = 200`; the reversed order would
// stall at 100 (B never sees a 100, then A makes one too late). The registration
// order is paired to the manifest entry order, exactly like the linked-host
// contract the other linked-plugin tests lock.
func TestEmitLinkedTransformsApplyInRegistrationOrder(t *testing.T) {
  resetLinkedPluginRegistry()
  // Two manifest entries paired by registration order to the two plugins below.
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"stageA","stage":"transform","config":{}},{"name":"stageB","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(&numericRewritePlugin{from: "0", to: "100"})   // stage A, registered first
  driver.RegisterPlugin(&numericRewritePlugin{from: "100", to: "200"}) // stage B, registered second

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  emitted := map[string]string{}
  if _, err := prog.EmitLinkedTransforms(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)

  if !strings.Contains(js, "exports.a = 200;") {
    t.Fatalf("linked transforms not applied A-then-B (expected exports.a = 200):\n%s", js)
  }
  // Guard the failure mode of reversed order explicitly: a stalled 100 means B
  // ran before A.
  if strings.Contains(js, "exports.a = 100;") {
    t.Fatalf("transforms applied out of registration order (stalled at 100):\n%s", js)
  }
}

// TestEmitLinkedTransformsReversedRegistrationStalls is the negative companion:
// registering stage B before stage A must NOT reach 200, proving the assertion
// above is sensitive to order rather than to the mere presence of both plugins.
func TestEmitLinkedTransformsReversedRegistrationStalls(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"stageB","stage":"transform","config":{}},{"name":"stageA","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(&numericRewritePlugin{from: "100", to: "200"}) // stage B first
  driver.RegisterPlugin(&numericRewritePlugin{from: "0", to: "100"})   // stage A second

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  defer prog.Close()

  emitted := map[string]string{}
  if _, err := prog.EmitLinkedTransforms(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)

  if !strings.Contains(js, "exports.a = 100;") {
    t.Fatalf("reversed order expected to stall at 100:\n%s", js)
  }
  if strings.Contains(js, "exports.a = 200;") {
    t.Fatalf("reversed order unexpectedly reached 200, chaining is order-insensitive:\n%s", js)
  }
}
