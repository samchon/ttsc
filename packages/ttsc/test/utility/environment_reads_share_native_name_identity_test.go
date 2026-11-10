package ttsc_test

import (
  "encoding/json"
  "os"
  "runtime"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// environmentAliasPlugin observes native name identity across a process edit.
type environmentAliasPlugin struct {
  read func(driver.PluginContext)
}

// SourcePreamble invokes the test's reads without adding source text.
func (plugin environmentAliasPlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  plugin.read(ctx)
  return "", nil
}

// TestUtilityEnvironmentReadsShareNativeNameIdentity verifies first-read
// stability follows native environment name identity.
//
// Windows aliases must see the same frozen value; POSIX names remain distinct.
//
// 1. Read a variable, change its process value, then read a case variant.
// 2. Probe invalid names and a variable set to an empty value.
// 3. Require native alias behavior and exactly the valid recorded inputs.
//
// @evidence contracts/testing.md#behavioral-verification RunTransform invokes a real linked preamble hook; its reads and emitted environmentInputs must agree on native alias identity, empty values and invalid names.
// @evidence contracts/testing.md#independent-expectations Literal values are set by t.Setenv; Windows has one case-insensitive name while POSIX has two distinct names.
// @evidence contracts/testing.md#distinguishing-cases Contrasts case aliases across an environment mutation, POSIX case distinctions, present-empty values, and empty, equals-bearing and NUL-bearing invalid names.
// @evidence contracts/testing.md#execution-ownership This Go unit calls the utility host in-process over a temporary project; t.Setenv and registry cleanup own all mutable process state.
func TestUtilityEnvironmentReadsShareNativeNameIdentity(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
  name := "TTSC_TEST_ENVIRONMENT_ALIAS"
  alias := strings.ToLower(name)
  empty := "TTSC_TEST_ENVIRONMENT_EMPTY"
  t.Setenv(name, "first")
  t.Setenv(empty, "")
  if runtime.GOOS != "windows" {
    t.Setenv(alias, "distinct")
  }
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  driver.RegisterPlugin(environmentAliasPlugin{read: func(ctx driver.PluginContext) {
    if value, ok := ctx.Env(name); !ok || value != "first" {
      t.Fatalf("first read = %q, %v", value, ok)
    }
    if err := os.Setenv(name, "changed"); err != nil {
      t.Fatal(err)
    }
    want := "first"
    if runtime.GOOS != "windows" {
      want = "distinct"
    }
    if value, ok := ctx.Env(alias); !ok || value != want {
      t.Errorf("case-variant read = %q, %v; want %q, true", value, ok, want)
    }
    if value, ok := ctx.Env(empty); !ok || value != "" {
      t.Errorf("empty value = %q, %v", value, ok)
    }
    for _, invalid := range []string{"", "A=B", "A\x00B"} {
      if value, ok := ctx.Env(invalid); ok || value != "" {
        t.Errorf("invalid name %q = %q, %v", invalid, value, ok)
      }
    }
  }})
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd", root, "--plugins-json", `[{"name":"env","stage":"transform","config":{}}]`})
  })
  if code != 0 || errOut != "" {
    t.Fatalf("transform = %d, %s", code, errOut)
  }
  var result struct {
    EnvironmentInputs map[string]*string `json:"environmentInputs"`
  }
  if err := json.Unmarshal([]byte(out), &result); err != nil {
    t.Fatal(err)
  }
  wantCount := 2
  if runtime.GOOS != "windows" {
    wantCount = 3
  }
  if len(result.EnvironmentInputs) != wantCount {
    t.Errorf("recorded inputs = %v; want %d names", result.EnvironmentInputs, wantCount)
  }
  if value := result.EnvironmentInputs[empty]; value == nil || *value != "" {
    t.Errorf("present-empty read was not preserved: %v", value)
  }
}
