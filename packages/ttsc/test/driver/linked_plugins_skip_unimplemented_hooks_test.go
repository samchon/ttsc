package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type linkedNoopPlugin struct{}

// TestDriverLinkedPluginsSkipUnimplementedHooks verifies that packages
// implementing no hook are skipped without error.
//
// A linked package may register only future hooks or platform-specific hooks.
// The driver must pair the manifest entry and then continue when the current
// pass has no interface to call.
//
// 1. Register a plugin value with no linked hook methods.
// 2. Load a Program with one linked manifest entry.
// 3. Assert loading and ApplyLinkedPlugins both succeed.
func TestDriverLinkedPluginsSkipUnimplementedHooks(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(linkedNoopPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"noop","stage":"transform","config":{}}]`)
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
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
}
