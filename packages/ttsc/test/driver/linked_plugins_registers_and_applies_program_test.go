package driver_test

import (
  "path/filepath"
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

// TestDriverLinkedPluginsRegistersAndAppliesProgram Verifies that registered
// package hooks receive their paired manifest entry.
//
// Locks the generic linked-host contract introduced for non-main transform
// packages: a registered package is paired with the manifest entry ttsc forwards
// through TTSC_LINKED_PLUGINS_JSON even though the entry's name ("whatever")
// has no relation to the package. A single registration and a single entry are
// used, so the case does not distinguish pairing by order from any other
// one-to-one pairing.
//
//  1. Register a probe that implements both linked plugin hooks.
//  2. Load a real Program with one linked plugin manifest entry.
//  3. Assert the source preamble was returned, ApplyProgram ran once, and both
//     hooks received the Program's cwd, the tsconfig name and that entry's name
//     and config.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram returns the probe preamble and ApplyLinkedPlugins calls its hook once with two captured contexts containing cwd, tsconfig, manifest name and answer.
// @evidence contracts/testing.md#independent-expectations The registered probe and literal manifest whatever/answer 42 establish the expected hook effects and context fields.
// @evidence contracts/testing.md#distinguishing-cases One registration pairs with one entry; this case cannot distinguish pairing by order from other one-to-one strategies.
// @evidence contracts/testing.md#execution-ownership The Go test/driver unit resets the registry and invokes linked hooks in process with a temporary Program; it builds no linked host.
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
  rootSlash := filepath.ToSlash(root)
  for _, ctx := range probe.contexts {
    if filepath.ToSlash(ctx.Cwd) != rootSlash || ctx.Tsconfig != "tsconfig.json" {
      t.Fatalf("context paths mismatch: %#v", ctx)
    }
    if ctx.Entry.Name != "whatever" || ctx.Entry.Config["answer"] != float64(42) {
      t.Fatalf("manifest entry mismatch: %#v", ctx.Entry)
    }
  }
}
