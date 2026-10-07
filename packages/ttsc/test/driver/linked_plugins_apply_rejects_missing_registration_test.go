package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLinkedPluginsApplyRejectsMissingRegistration Verifies that missing
// registrations are checked during ApplyProgram too.
//
// Source-preamble collection and Program mutation are separate phases. This
// test pins the mutation-phase guard by clearing the registry after Program
// load but before ApplyLinkedPlugins.
//
// 1. Load a Program with a registered no-op linked plugin.
// 2. Clear the registry before applying linked plugins.
// 3. Assert ApplyLinkedPlugins rejects the missing registration.
//
// @evidence contracts/testing.md#behavioral-verification ApplyLinkedPlugins reports a registry entry removed after loading.
// @evidence contracts/testing.md#independent-expectations The one-entry manifest requires a corresponding registered plugin.
// @evidence contracts/testing.md#distinguishing-cases Registered-at-load then missing-at-apply contrasts with missing-at-load coverage.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverLinkedPluginsApplyRejectsMissingRegistration is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestDriverLinkedPluginsApplyRejectsMissingRegistration(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(linkedNoopPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"lost","stage":"transform","config":{}}]`)
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
  resetLinkedPluginRegistry()
  err = prog.ApplyLinkedPlugins()
  if err == nil || !strings.Contains(err.Error(), "no linked plugin registered") {
    t.Fatalf("expected apply missing registration error, got %v", err)
  }
}
