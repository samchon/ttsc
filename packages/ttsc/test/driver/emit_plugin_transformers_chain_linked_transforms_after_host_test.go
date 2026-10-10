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

// TestEmitWithPluginTransformersChainLinkedTransformsAfterHost verifies that
// linked EmitTransformPlugins join the per-file chain AFTER the transforms the
// host passed explicitly.
//
// Locks the merge position of EmitWithPluginTransformers, which honors linked
// plugins itself: the host's own transform keeps the first slot (existing hosts
// were built against that timing) and linked transforms ride behind it. The probe is order-sensitive: the host rewrites
// 100 -> 200 and the linked plugin rewrites 0 -> 100, so host-then-linked
// stalls at 100 while linked-then-host would reach 200.
//
// 1. Register a linked EmitTransformPlugin (0 -> 100) with one manifest entry.
// 2. Emit through EmitWithPluginTransformers with a host transform (100 -> 200).
// 3. Assert the output stalls at `exports.a = 100;`, proving host-then-linked.
// @evidence contracts/testing.md#behavioral-verification Runs actual host and linked numeric transforms through EmitWithPluginTransformers, requires one host invocation for the sole source, and requires stalled 100 while rejecting 200.
// @evidence contracts/testing.md#independent-expectations Authored initial zero, host 100-to-200 and linked zero-to-100 imply literal 100 for host-first ordering.
// @evidence contracts/testing.md#distinguishing-cases Two dependent transforms distinguish host-first from linked-first ordering; 200 is an explicit forbidden result.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit registers the actual in-process linked transform with test-scoped manifest and closes its private Program after captured emission; no plugin binary executes.
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
  hostCalls := 0
  observedHost := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    hostCalls++
    return hostTransform(ec, sf)
  }
  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{observedHost}, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)
  if hostCalls != 1 {
    t.Fatalf("expected one host transform invocation for index.ts, got %d", hostCalls)
  }

  if !strings.Contains(js, "exports.a = 100;") {
    t.Fatalf("expected host-then-linked chaining to stall at 100:\n%s", js)
  }
  if strings.Contains(js, "exports.a = 200;") {
    t.Fatalf("linked transform ran before the host's own transform:\n%s", js)
  }
}
