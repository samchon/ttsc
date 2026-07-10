package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformersChainLinkedTransformsAfterHost verifies that
// linked EmitTransformPlugins join the per-file chain AFTER the transforms the
// host passed explicitly.
//
// Locks the merge position introduced when EmitWithPluginTransformers started
// honoring linked plugins itself: the host's own transform keeps its current
// first slot (existing hosts were built against that timing) and linked
// transforms ride behind it. The probe is order-sensitive: the host rewrites
// 100 -> 200 and the linked plugin rewrites 0 -> 100, so host-then-linked
// stalls at 100 while linked-then-host would reach 200.
//
// 1. Register a linked EmitTransformPlugin (0 -> 100) with one manifest entry.
// 2. Emit through EmitWithPluginTransformers with a host transform (100 -> 200).
// 3. Assert the output stalls at `exports.a = 100;`, proving host-then-linked.
func TestEmitWithPluginTransformersChainLinkedTransformsAfterHost(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"linked","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(&numericRewritePlugin{from: "0", to: "100"})

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

  hostTransform, err := (&numericRewritePlugin{from: "100", to: "200"}).EmitTransform(driver.PluginContext{})
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

  if !strings.Contains(js, "exports.a = 100;") {
    t.Fatalf("expected host-then-linked chaining to stall at 100:\n%s", js)
  }
  if strings.Contains(js, "exports.a = 200;") {
    t.Fatalf("linked transform ran before the host's own transform:\n%s", js)
  }
}
