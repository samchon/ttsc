package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// stringRewriteProgramPlugin is a synthetic ProgramPlugin shaped like
// @ttsc/paths: ApplyProgram mutates matching string literals in place across
// every program source file, so its effect is only visible in emitted output
// when the emit path actually runs linked ProgramPlugin hooks.
type stringRewriteProgramPlugin struct {
  from string
  to   string
}

func (p *stringRewriteProgramPlugin) ApplyProgram(prog *driver.Program, _ driver.PluginContext) error {
  for _, sf := range prog.SourceFiles() {
    rewriteStringLiterals(sf.AsNode(), p.from, p.to)
  }
  return nil
}

func rewriteStringLiterals(node *shimast.Node, from, to string) {
  if node == nil {
    return
  }
  if node.Kind == shimast.KindStringLiteral && node.Text() == from {
    node.AsStringLiteral().Text = to
    node.Flags |= shimast.NodeFlagsSynthesized
    node.Loc = shimcore.UndefinedTextRange()
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    rewriteStringLiterals(child, from, to)
    return false
  })
}

// TestEmitWithPluginTransformersAppliesLinkedProgramPlugins verifies that a
// host emitting through EmitWithPluginTransformers with only its own
// transform still runs linked ProgramPlugin hooks.
//
// Locks the regression where a third-party transform host (typia's
// `ttsc-typia build`) passed its own PluginTransform to
// EmitWithPluginTransformers and a linked plugin (@ttsc/paths) compiled into
// the same binary registered via init() but its ApplyProgram never ran, so
// tsconfig paths aliases survived into the emitted JavaScript. The linked
// hooks must fire at the emit funnel itself, not only on the utility-host
// code path that calls ApplyLinkedPlugins by hand.
//
//  1. Register a linked ProgramPlugin that rewrites "linked-pending" into
//     "linked-applied" and pair it with one manifest entry.
//  2. Emit through EmitWithPluginTransformers passing only a host-owned
//     transform (numeric 0 -> 100).
//  3. Assert the emitted JS carries BOTH the host transform's rewrite and the
//     linked plugin's rewrite.
func TestEmitWithPluginTransformersAppliesLinkedProgramPlugins(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"rewrite","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(&stringRewriteProgramPlugin{from: "linked-pending", to: "linked-applied"})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const spec = \"linked-pending\";\nexport const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  hostTransform, err := (&numericRewritePlugin{from: "0", to: "100"}).EmitTransform(driver.PluginContext{})
  if err != nil {
    t.Fatal(err)
  }
  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{hostTransform}, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)

  if !strings.Contains(js, "linked-applied") {
    t.Fatalf("linked ProgramPlugin did not apply on the host emit path:\n%s", js)
  }
  if !strings.Contains(js, "exports.a = 100;") {
    t.Fatalf("host-owned transform was lost:\n%s", js)
  }
}

// TestEmitWithPluginTransformersWithoutManifestLeavesLinkedHooksIdle is the
// negative companion: a registered plugin with NO manifest entry must not run.
// The manifest, not registration alone, gates linked hook execution — without
// this guard the fix above could regress into always-on registry side effects.
func TestEmitWithPluginTransformersWithoutManifestLeavesLinkedHooksIdle(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, "")
  driver.RegisterPlugin(&stringRewriteProgramPlugin{from: "linked-pending", to: "linked-applied"})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const spec = \"linked-pending\";\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformers(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)

  if !strings.Contains(js, "linked-pending") {
    t.Fatalf("expected untouched literal without a manifest entry:\n%s", js)
  }
  if strings.Contains(js, "linked-applied") {
    t.Fatalf("linked hook ran without a manifest entry:\n%s", js)
  }
}
