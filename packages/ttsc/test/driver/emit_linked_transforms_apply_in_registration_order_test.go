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

// TestEmitLinkedTransformsApplyInRegistrationOrder Verifies registered linked transforms feed
// each result to the next transform in registration order.
//
// Stage A replaces 0 with 100 and stage B replaces 100 with 200. Only A followed by B
// reaches the authored final value; the reversed registration companion distinguishes
// chaining order from the presence of both hooks.
//
// 1. Register the 0-to-100 transform before the 100-to-200 transform.
// 2. Emit through the linked transforms and require 200 while rejecting the intermediate 100 assignment.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual registered emit transforms through EmitLinkedTransforms and requires exports.a = 200 while rejecting the stalled 100 output.
// @evidence contracts/testing.md#independent-expectations Authored stages replace 0 with 100 and 100 with 200, so sequential A then B independently owes 200; no expected output is obtained from a reference emitter.
// @evidence contracts/testing.md#distinguishing-cases The two-stage dependency makes registration order observable; the adjacent reversed-registration entry must stall at 100.
// @evidence contracts/testing.md#execution-ownership This direct driver Go unit executes registered in-process transforms on a private Program and write map, closes its Program and scopes its manifest environment; it installs or builds no plugin executable.
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

// TestEmitLinkedTransformsReversedRegistrationStalls Verifies reversing the linked numeric
// transforms produces 100 instead of 200.
//
// Stage B sees the original zero before stage A creates 100, so B cannot produce 200. This
// reversed input is the control for the registration-order result and exposes an
// implementation that silently reorders the hooks.
//
// 1. Register the 100-to-200 transform before the 0-to-100 transform.
// 2. Emit through that reversed order and require 100 while rejecting 200.
//
// @evidence contracts/testing.md#behavioral-verification Runs B then A through the actual registered-transform emitter and requires exports.a = 100 while rejecting 200.
// @evidence contracts/testing.md#independent-expectations B cannot replace the authored initial zero, then A replaces zero with 100; literal 100 and absent 200 independently define this reversed order.
// @evidence contracts/testing.md#distinguishing-cases Reversed registration contrasts the adjacent A-then-B positive, detecting order-insensitive chaining or sorting by plugin name.
// @evidence contracts/testing.md#execution-ownership This owning Go unit loads and closes one in-process Program and captures real emitted writes with a fresh registry and test-scoped manifest; no compiler host or installed plugin runs.
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
