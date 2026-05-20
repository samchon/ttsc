package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type linkedPluginProbe struct {
  applied  int
  contexts []driver.PluginContext
}

func (p *linkedPluginProbe) SourcePreamble(ctx driver.PluginContext) (string, error) {
  p.contexts = append(p.contexts, ctx)
  return "// linked preamble\n", nil
}

func (p *linkedPluginProbe) ApplyProgram(_ *driver.Program, ctx driver.PluginContext) error {
  p.applied++
  p.contexts = append(p.contexts, ctx)
  return nil
}

// TestDriverLinkedPluginsRegistersAndAppliesProgram verifies that registered
// package hooks receive their paired manifest entry.
//
// Locks the generic linked-host contract introduced for non-main transform
// packages. Registration order, not package name, pairs a linked Go package
// with the manifest entry ttsc forwards through TTSC_LINKED_PLUGINS_JSON.
//
// 1. Register a probe that implements both linked plugin hooks.
// 2. Load a real Program with one linked plugin manifest entry.
// 3. Assert source preamble and Program hooks see the same config.
func TestDriverLinkedPluginsRegistersAndAppliesProgram(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"whatever","stage":"transform","config":{"answer":42}}]`)
  probe := &linkedPluginProbe{}
  driver.RegisterPlugin(probe)

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  if prog.SourcePreamble != "// linked preamble\n" {
    t.Fatalf("source preamble mismatch: %q", prog.SourcePreamble)
  }
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
  if probe.applied != 1 || len(probe.contexts) != 2 {
    t.Fatalf("plugin hooks were not called: applied=%d contexts=%#v", probe.applied, probe.contexts)
  }
  for _, ctx := range probe.contexts {
    if ctx.Cwd != root || ctx.Tsconfig != "tsconfig.json" {
      t.Fatalf("context paths mismatch: %#v", ctx)
    }
    if ctx.Entry.Name != "whatever" || ctx.Entry.Config["answer"] != float64(42) {
      t.Fatalf("manifest entry mismatch: %#v", ctx.Entry)
    }
  }
}
