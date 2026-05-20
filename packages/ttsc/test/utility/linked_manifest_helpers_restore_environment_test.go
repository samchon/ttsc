package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestUtilityLinkedManifestHelpersRestoreEnvironment verifies utility linked
// manifest helpers preserve process environment state.
//
// The generic utility host pushes linked plugin entries through an environment
// variable while loading the Program. The restore helper must undo the change
// whether the variable was previously set or absent, so the test state does
// not leak across sequential subtests in the same process.
//
// 1. Parse empty, valid, and invalid plugin manifests through the helper.
// 2. Set and restore the linked-plugin env in both the set and unset states.
// 3. Assert preamble and output-key predicates handle non-target paths.
func TestUtilityLinkedManifestHelpersRestoreEnvironment(t *testing.T) {
  empty, err := utilityParsePluginEntries("   ")
  if err != nil || empty != nil {
    t.Fatalf("empty manifest mismatch: entries=%#v err=%v", empty, err)
  }
  entries, err := utilityParsePluginEntries(`[{"name":"x","stage":"transform","config":{"value":1}}]`)
  if err != nil {
    t.Fatal(err)
  }
  if len(entries) != 1 || entries[0].Name != "x" || entries[0].Config["value"] != float64(1) {
    t.Fatalf("manifest entries mismatch: %#v", entries)
  }
  if _, err := utilityParsePluginEntries(`{`); err == nil {
    t.Fatal("invalid manifest was accepted")
  }

  t.Setenv(driver.LinkedPluginsEnv, "previous")
  restore := utilitySetLinkedPluginManifest(`[{"name":"x"}]`)
  if got := os.Getenv(driver.LinkedPluginsEnv); !strings.Contains(got, `"name":"x"`) {
    t.Fatalf("manifest env was not set: %q", got)
  }
  restore()
  if got := os.Getenv(driver.LinkedPluginsEnv); got != "previous" {
    t.Fatalf("manifest env was not restored: %q", got)
  }
  if err := os.Unsetenv(driver.LinkedPluginsEnv); err != nil {
    t.Fatal(err)
  }
  restore = utilitySetLinkedPluginManifest("")
  if _, ok := os.LookupEnv(driver.LinkedPluginsEnv); ok {
    t.Fatal("empty manifest did not clear env")
  }
  restore()
  if _, ok := os.LookupEnv(driver.LinkedPluginsEnv); ok {
    t.Fatal("restore recreated absent env")
  }

  if utilityShouldEnsureSourcePreamble("index.ts", "", "// banner\n") {
    t.Fatal("source preamble should not be ensured for TypeScript output")
  }
  if utilityShouldEnsureSourcePreamble("index.js", "// banner\n", "// banner\n") {
    t.Fatal("source preamble should not be duplicated")
  }
  outside := filepath.Join(filepath.Dir(t.TempDir()), "outside.js")
  if got := utilityAPIOutputKey(t.TempDir(), outside); !strings.HasSuffix(got, "outside.js") {
    t.Fatalf("outside output key mismatch: %q", got)
  }
}
